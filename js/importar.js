// importar.js: "Importar lista" na vista Compras. Lê texto colado, com títulos de categorias
// seguidos de produtos, mostra como foi interpretado e só depois grava.

// Início de linha: "*", "-", "1." e caixas como "[ ]" ou "☐", sozinhos ou combinados.
const MARCADOR = /^(?:(?:[-*+•·◦‣–—]\s*|\d+[.)]\s+))?(?:\[[ xX✓]?\]\s*)?(?:[☐☑☒✓✔✅⬜⬛◻◼□■○◯●￼]️?\s*)?/u;
const SEPARADOR = /^(?:[-*_=]\s*){3,}$/;
const CABECALHO = /^#{1,6}\s+(.+)$/;
const NEGRITO = /^(?:\*\*|__)(.+?)(?:\*\*|__):?$/;

function classificarLinha(bruta) {
  // O carácter U+FFFC, tratado como marcador acima, pode ser uma caixa colada das Notas do iPhone.
  const linha = bruta.replace(/[​﻿]/g, '').replace(/ /g, ' ').trim();
  if (!linha || SEPARADOR.test(linha)) return { vazia: true };

  const destacada = linha.match(CABECALHO) || linha.match(NEGRITO);
  if (destacada) return { texto: destacada[1].trim().replace(/:$/, ''), original: linha, tituloClaro: true };

  const marcador = linha.match(MARCADOR)[0];
  const resto = linha.slice(marcador.length).trim();
  if (!resto) return { vazia: true };
  const terminaEmDoisPontos = resto.endsWith(':');
  return {
    texto: resto.replace(/:$/, '').trim(),
    original: linha,
    marcada: marcador !== '',
    tituloClaro: terminaEmDoisPontos,
  };
}

// Devolve o que encontrou no texto, sem alterar os dados da app.
function analisarLista(texto) {
  const linhas = texto.split(/\r\n|\r|\n/).map(classificarLinha);
  const tiposConhecidos = new Map(tiposDeCompras().map((tipo) => [chaveTexto(tipo), tipo]));
  const grupos = [];
  const ignoradas = [];
  let grupoAtual = null;
  let aSaltarInstrucoes = false;
  let saltouTexto = false;

  const abrirGrupo = (nome) => {
    const tipo = tiposConhecidos.get(chaveTexto(nome)) || nome;
    let grupo = grupos.find((g) => chaveTexto(g.tipo) === chaveTexto(tipo));
    if (!grupo) {
      grupo = { tipo, produtos: [] };
      grupos.push(grupo);
    }
    return grupo;
  };

  linhas.forEach((linha, i) => {
    if (linha.vazia) {
      if (aSaltarInstrucoes && saltouTexto) aSaltarInstrucoes = false;
      return;
    }

    const chave = chaveTexto(linha.texto);
    if (/^lista d[ea]s? compras$/.test(chave)) {
      ignoradas.push(linha.original);
      return;
    }
    if (/^(como usar|instrucoes)$/.test(chave)) {
      ignoradas.push(linha.original);
      aSaltarInstrucoes = true;
      saltouTexto = false;
      return;
    }

    // Decide se a linha é um título.
    const seguinte = linhas[i + 1];
    const anterior = linhas[i - 1];
    const proxima = linhas.slice(i + 1).find((l) => !l.vazia);
    const inicioDeBloco = !anterior || anterior.vazia;
    const seguidaDeProdutos = Boolean(proxima && proxima.marcada);
    const inicioComLista = inicioDeBloco && Boolean(seguinte && !seguinte.vazia);
    const conhecida = !linha.marcada && tiposConhecidos.has(chave);
    const titulo = linha.tituloClaro || conhecida
      || (!linha.marcada && !aSaltarInstrucoes && (seguidaDeProdutos || inicioComLista));

    if (aSaltarInstrucoes && !linha.tituloClaro && !conhecida) {
      ignoradas.push(linha.original);
      saltouTexto = true;
      return;
    }
    aSaltarInstrucoes = false;

    if (titulo) {
      grupoAtual = abrirGrupo(linha.texto);
      return;
    }
    if (!grupoAtual) grupoAtual = abrirGrupo('Outros');
    if (!grupoAtual.produtos.some((nome) => chaveTexto(nome) === chave)) {
      grupoAtual.produtos.push(primeiraMaiuscula(linha.texto));
    }
  });

  return { grupos, ignoradas };
}

function jaExisteProduto(nome, tipo) {
  return dados.compras.some((p) => chaveTexto(p.nome) === chaveTexto(nome) && chaveTexto(p.tipo) === chaveTexto(tipo));
}

function contarNovos(analise) {
  return analise.grupos.reduce((total, grupo) => (
    total + grupo.produtos.filter((nome) => !jaExisteProduto(nome, grupo.tipo)).length
  ), 0);
}

// Acrescenta à lista atual. Um produto que já exista fica como está.
function gravarImportacao(analise) {
  analise.grupos.forEach((grupo) => {
    if (!tiposDeCompras().some((tipo) => chaveTexto(tipo) === chaveTexto(grupo.tipo))) {
      dados.tiposCompras.push(grupo.tipo);
    }
    grupo.produtos.forEach((nome) => {
      if (!jaExisteProduto(nome, grupo.tipo)) {
        dados.compras.push({ id: novoId(), nome, tipo: grupo.tipo, comprar: false });
      }
    });
  });
  guardarDados();
}

function limparPrevia() {
  document.getElementById('importar-previa').replaceChildren();
}

function fecharImportacao() {
  document.getElementById('importar-texto').value = '';
  document.getElementById('importar-caixa').open = false;
  limparPrevia();
}

function mostrarPrevia(analise) {
  const novos = contarNovos(analise);
  const total = analise.grupos.reduce((soma, grupo) => soma + grupo.produtos.length, 0);
  const repetidos = total - novos;
  const elementos = [];

  analise.grupos.forEach((grupo) => {
    elementos.push(criar('h3', { textContent: `${grupo.tipo} (${grupo.produtos.length})` }));
    if (grupo.produtos.length > 0) {
      elementos.push(criar('ul', { className: 'previa-lista' },
        ...grupo.produtos.map((nome) => criar('li', { textContent: nome }))));
    } else {
      elementos.push(criar('p', { className: 'nota-previa', textContent: 'Sem produtos.' }));
    }
  });
  if (repetidos > 0) {
    elementos.push(criar('p', { className: 'nota-previa', textContent: `${repetidos} já estão na lista e ficam como estão.` }));
  }
  if (analise.ignoradas.length > 0) {
    elementos.push(criar('p', { className: 'nota-previa', textContent: `Linhas ignoradas: ${analise.ignoradas.join(' · ')}` }));
  }
  elementos.push(
    criar('p', { className: 'nota-previa', textContent: 'Se um título aparecer como produto, escreve ":" no fim dessa linha e volta a pré-visualizar.' }),
    criar('button', {
      type: 'button',
      className: 'botao-principal',
      textContent: `Importar ${novos} ${novos === 1 ? 'produto' : 'produtos'} como "Não"`,
      onclick: () => {
        gravarImportacao(analise);
        fecharImportacao();
        // Os produtos entram como "Não": com o filtro ligado, não apareceriam.
        document.getElementById('compras-filtro').checked = false;
        desenharCompras();
        avisar(`${novos} ${novos === 1 ? 'produto importado' : 'produtos importados'} como "Não".`);
      },
    }),
    criar('button', { type: 'button', className: 'botao-secundario', textContent: 'Cancelar', onclick: limparPrevia }),
  );
  document.getElementById('importar-previa').replaceChildren(...elementos);
}

document.getElementById('importar-formulario').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const analise = analisarLista(document.getElementById('importar-texto').value);
  if (analise.grupos.length === 0) {
    limparPrevia();
    avisar('Não encontrei títulos nem produtos neste texto.');
    return;
  }
  mostrarPrevia(analise);
});
// Se o texto mudar, a pré-visualização deixa de corresponder.
document.getElementById('importar-texto').addEventListener('input', limparPrevia);
