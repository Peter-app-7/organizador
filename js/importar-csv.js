// importar-csv.js: "Importar (CSV)" (aria-label "Importar gastos (CSV)"), no topo da vista Gastos, ao lado de
// "Exportar (CSV)", e a secção "Pessoas dos gastos importados" das Definições (nome a mostrar, só para o ecrã).
// Junta neste aparelho os gastos de outra pessoa (do outro telemóvel), a partir do ficheiro que o "Exportar gastos (CSV)"
// dela gera (ex.: partilhado por uma pasta do Google Drive). Sem nuvem: os gastos não se sincronizam, juntam-se por ficheiro.
//
// - Os gastos importados ficam em organizador-despesas, como gastos gerais, com "pessoa" (o nome como vem no ficheiro),
//   "csvMarca" ("pessoa normalizada|id do ficheiro") e "origemOriginal" ("compras", "manual" ou "cartao").
//   Nunca se misturam com os meus: o seletor "Meus · <pessoa> · Casa" (despesas.js) separa-os.
// - Sem duplicados: cada marca importada fica em dados.csvImportados; uma marca que lá esteja, ou num gasto, não volta
//   a entrar (nem depois de apagar ou editar o gasto).
// - As linhas com o meu nome (Definições, "O teu nome") são minhas e são ignoradas.
// - Não cria, não aplica e não muda regras dos comerciantes lembrados.

const FICHEIRO_CSV_MAXIMO = 5 * 1024 * 1024; // 5 MB
const botaoImportarCsv = document.getElementById('gastos-importar-csv');
const campoImportarCsv = document.getElementById('gastos-importar-csv-ficheiro');
const previaImportarCsv = document.getElementById('gastos-importar-csv-previa');

// Nome de uma pessoa para comparar: minúsculas, sem acentos e sem espaços a mais.
function chavePessoa(nome) {
  return chaveTexto(String(nome || ''));
}

// A mensagem fica por baixo dos botões CSV, na caixa partilhada do topo dos Gastos (despesas.js).
function mostrarResultadoCsv(texto) {
  mostrarResultadoGastos(texto);
}

// Lê texto CSV separado por ";": campos entre aspas podem ter ";", quebras de linha e aspas repetidas ("").
// Devolve uma lista de registos; cada registo é { campos: [...], malFormado }. Linhas vazias não aparecem.
function lerRegistosCsv(texto) {
  const registos = [];
  let campos = [];
  let campo = '';
  let malFormado = false;
  let entreAspas = false;
  let campoComAspas = false; // o campo começou com aspas
  let depoisDasAspas = false; // as aspas do campo já fecharam
  const fecharCampo = () => {
    campos.push(campo);
    campo = '';
    campoComAspas = false;
    depoisDasAspas = false;
  };
  const fecharRegisto = () => {
    fecharCampo();
    // Linha vazia (ou só com espaços): não conta.
    if (!(campos.length === 1 && !campos[0].trim() && !malFormado)) registos.push({ campos, malFormado });
    campos = [];
    malFormado = false;
  };
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          entreAspas = false;
          depoisDasAspas = true;
        }
      } else {
        campo += c;
      }
    } else if (c === ';') {
      fecharCampo();
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && texto[i + 1] === '\n') i += 1;
      fecharRegisto();
    } else if (c === '"' && campo === '' && !campoComAspas) {
      entreAspas = true;
      campoComAspas = true;
    } else {
      // Texto depois das aspas fechadas, ou aspas soltas a meio de um campo: a linha está mal formada.
      if (depoisDasAspas || c === '"') malFormado = true;
      campo += c;
    }
  }
  // Aspas que nunca fecham: o resto do ficheiro fica nesse registo, que conta como mal formado.
  if (entreAspas) malFormado = true;
  if (campo !== '' || campos.length > 0 || malFormado) fecharRegisto();
  return registos;
}

// Uma linha de dados do ficheiro: { id, data, pessoa, origem, categoria, descricao, comerciante, centimos } ou null.
function lerLinhaCsvGasto(registo) {
  if (registo.malFormado || registo.campos.length !== CABECALHO_CSV.length) return null;
  const [id, data, , pessoa, origem, categoria, descricao, comerciante, valor] = registo.campos;
  const lido = lerValor(valor);
  if (!id.trim() || !dataValida(data.trim()) || lido.erro) return null;
  return {
    id: id.trim(),
    data: data.trim(),
    pessoa: limparNomeExportacao(pessoa),
    origem: ORIGENS_CSV.includes(origem.trim()) ? origem.trim() : 'manual',
    categoria: categoria.replace(/\s+/g, ' ').trim(),
    descricao: descricao.replace(/\s+/g, ' ').trim().slice(0, NOTA_MAXIMA),
    comerciante: comerciante.replace(/\s+/g, ' ').trim().slice(0, NOTA_MAXIMA),
    centimos: lido.centimos,
  };
}

// Lê o ficheiro e separa as linhas. Devolve { erro } (nada a importar) ou
// { novas, repetidas, minhas, ignoradas }, com as novas já com a marca.
function analisarCsvGastos(texto, meuNome) {
  const registos = lerRegistosCsv(texto.replace(/^﻿/, ''));
  if (registos.length === 0) return { erro: 'O ficheiro está vazio. Nada foi importado.' };
  const [cabecalho, ...linhas] = registos;
  if (cabecalho.malFormado || cabecalho.campos.join(';') !== CABECALHO_CSV.join(';')) {
    return { erro: 'Este ficheiro não é uma exportação de gastos do Organizador.' };
  }
  const validas = [];
  let ignoradas = 0;
  linhas.forEach((registo) => {
    const linha = lerLinhaCsvGasto(registo);
    if (linha) validas.push(linha);
    else ignoradas += 1;
  });
  const textoIgnoradas = `${ignoradas} ${ignoradas === 1 ? 'linha ignorada' : 'linhas ignoradas'}`;
  if (validas.length === 0) {
    return { erro: linhas.length === 0 ? 'O ficheiro não tem gastos. Nada foi importado.' : `Nenhum gasto válido no ficheiro (${textoIgnoradas}). Nada foi importado.` };
  }
  if (!validas.some((linha) => linha.pessoa)) {
    return { erro: 'O ficheiro não tem nome. No outro telemóvel, escreve o nome em Definições e exporta outra vez.' };
  }

  const minha = chavePessoa(meuNome);
  // Marcas já importadas: as registadas e as dos gastos (servem também depois de restaurar uma cópia antiga).
  const jaImportadas = new Set(Object.keys(dados.csvImportados));
  despesas.forEach((d) => { if (d.csvMarca) jaImportadas.add(d.csvMarca); });
  const novas = [];
  let repetidas = 0;
  let minhas = 0;
  validas.forEach((linha) => {
    if (!linha.pessoa) {
      ignoradas += 1;
      return;
    }
    if (chavePessoa(linha.pessoa) === minha) {
      minhas += 1;
      return;
    }
    const marca = `${chavePessoa(linha.pessoa)}|${linha.id}`;
    // A mesma marca duas vezes no ficheiro também só entra uma vez.
    if (jaImportadas.has(marca)) {
      repetidas += 1;
      return;
    }
    jaImportadas.add(marca);
    novas.push({ ...linha, marca });
  });
  return { novas, repetidas, minhas, ignoradas };
}

// Categoria de um gasto importado: as compras vão para a Mercearia; as outras, para a minha categoria com o mesmo nome
// (sem contar maiúsculas e acentos) ou, se não houver, para "Por categorizar". Devolve o id, ou null para "Por categorizar".
function categoriaDoCsv(linha) {
  if (linha.origem === 'compras') return 'mercearia';
  const categoria = categoriasDespesas.find((c) => chaveTexto(c.nome) === chaveTexto(linha.categoria));
  return categoria ? categoria.id : null;
}

// Texto do resumo, ex.: "3 gastos novos de Pessoa B · 2 já importados · 1 teu, ignorado · 0 linhas ignoradas".
// Usa o nome a mostrar de cada pessoa (Definições), como o seletor.
function partesResumoCsv({ novas, repetidas, minhas, ignoradas }) {
  const porPessoa = new Map();
  novas.forEach((linha) => {
    const chave = chavePessoa(linha.pessoa);
    if (!porPessoa.has(chave)) porPessoa.set(chave, { nome: nomeAMostrar(linha.pessoa), numero: 0 });
    porPessoa.get(chave).numero += 1;
  });
  const partes = porPessoa.size
    ? [...porPessoa.values()].map(({ nome, numero }) => `${numero} ${numero === 1 ? 'gasto novo' : 'gastos novos'} de ${nome}`)
    : ['0 gastos novos'];
  partes.push(`${repetidas} já ${repetidas === 1 ? 'importado' : 'importados'}`);
  partes.push(`${minhas} ${minhas === 1 ? 'teu, ignorado' : 'teus, ignorados'}`);
  partes.push(`${ignoradas} ${ignoradas === 1 ? 'linha ignorada' : 'linhas ignoradas'}`);
  return partes;
}

// --- Confirmação: painel na página, por baixo do botão ---
let analiseCsvPendente = null;

function fecharPreviaCsv() {
  analiseCsvPendente = null;
  previaImportarCsv.replaceChildren();
  previaImportarCsv.hidden = true;
  fechadoSemVoltar('importar-csv');
}

function mostrarPreviaCsv(analise, meuNome) {
  analiseCsvPendente = { analise, meuNome };
  const partes = partesResumoCsv(analise);
  const semCategoria = analise.novas.filter((linha) => !categoriaDoCsv(linha)).length;
  const numero = analise.novas.length;
  previaImportarCsv.replaceChildren(
    criar('h3', { className: 'despesas-registo-titulo', id: 'gastos-importar-csv-titulo', textContent: 'Importar gastos' }),
    criar('ul', { className: 'previa-lista' }, ...partes.map((parte) => criar('li', { textContent: parte }))),
    ...(semCategoria ? [criar('p', { className: 'nota-previa', textContent: `${semCategoria} ${semCategoria === 1 ? 'fica' : 'ficam'} em "${CATEGORIA_POR_CATEGORIZAR}" (categoria que não existe neste aparelho).` })] : []),
    criar('p', { className: 'nota-previa', textContent: 'Os gastos importados não se misturam com os teus: escolhe "Meus", a pessoa ou "Casa" por cima da lista.' }),
    criar('div', { className: 'formulario formulario-gasto' },
      criar('button', { type: 'button', className: 'botao-principal', textContent: `Importar ${numero} ${numero === 1 ? 'gasto' : 'gastos'}`, onclick: confirmarImportarCsv }),
      criar('button', { type: 'button', className: 'botao-secundario', textContent: 'Cancelar', onclick: () => { fecharPreviaCsv(); botaoImportarCsv.focus(); } })),
  );
  previaImportarCsv.setAttribute('aria-labelledby', 'gastos-importar-csv-titulo');
  previaImportarCsv.hidden = false;
  abrirComVoltar('importar-csv', 'gastos', fecharPreviaCsv);
  const confirmar = previaImportarCsv.querySelector('.botao-principal');
  confirmar.focus({ preventScroll: true });
  setTimeout(() => previaImportarCsv.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
}

function confirmarImportarCsv() {
  if (!analiseCsvPendente) return;
  const { analise: anterior, meuNome } = analiseCsvPendente;
  // Entretanto pode ter entrado outro ficheiro: volta a separar as novas, com o que está agora guardado.
  const jaImportadas = new Set(Object.keys(dados.csvImportados));
  despesas.forEach((d) => { if (d.csvMarca) jaImportadas.add(d.csvMarca); });
  const novas = anterior.novas.filter((linha) => !jaImportadas.has(linha.marca));
  const analise = { ...anterior, novas, repetidas: anterior.repetidas + (anterior.novas.length - novas.length) };
  fecharPreviaCsv();
  if (novas.length === 0) {
    mostrarResultadoCsv(`Nada de novo: ${partesResumoCsv(analise).join(' · ')}. Nada foi alterado.`);
    return;
  }
  const precisaPorCategorizar = novas.some((linha) => !categoriaDoCsv(linha));
  const porCategorizar = precisaPorCategorizar ? garantirCategoriaPorCategorizar() : null;
  if (precisaPorCategorizar && !porCategorizar) return; // já foi avisado de que não deu para guardar
  const antes = despesas;
  const novos = novas.map((linha) => ({
    id: novoId(),
    data: linha.data,
    categoria: categoriaDoCsv(linha) || porCategorizar,
    centimos: linha.centimos,
    nota: linha.descricao,
    ...(linha.comerciante ? { comerciante: linha.comerciante } : {}),
    pessoa: linha.pessoa,
    csvMarca: linha.marca,
    origemOriginal: linha.origem,
  }));
  // Ids únicos, mesmo criados no mesmo milissegundo.
  const ids = new Set(despesas.map((d) => d.id));
  novos.forEach((d) => {
    while (ids.has(d.id)) d.id = novoId();
    ids.add(d.id);
  });
  despesas = [...despesas, ...novos];
  if (!guardarDespesas()) {
    despesas = antes;
    return;
  }
  novos.forEach((d) => { dados.csvImportados[d.csvMarca] = 1; });
  guardarDados();
  if (precisaPorCategorizar) correrSemFalhar(desenharCategoriasDespesas);

  // O seletor passa para a pessoa do gasto novo mais recente e o período para o dele.
  const maisRecente = [...novos].sort((a, b) => a.data.localeCompare(b.data)).pop();
  escolhaPessoas = chavePessoa(maisRecente.pessoa);
  gastosADestacar = novos.map((d) => `despesa:${d.id}`);
  mesDeslocamento = deslocamentoDaData(maisRecente.data);
  despesaAEditar = null;
  fecharNovaDespesa();
  desenharMes();
  const semCategoria = novos.filter((d) => d.categoria === porCategorizar).length;
  const dica = semCategoria ? ` ${semCategoria} em "${CATEGORIA_POR_CATEGORIZAR}": toca num gasto para mudar a categoria.` : '';
  mostrarResultadoCsv(`Importação: ${partesResumoCsv(analise).join(' · ')}.${dica}`);
}

async function importarGastosCsv(ficheiro) {
  fecharPreviaCsv();
  const meuNome = lerNomeExportacao();
  if (!meuNome) {
    mostrarResultadoCsv('Escreve primeiro o teu nome em Definições, para a app saber quais são os teus gastos.');
    return;
  }
  if (ficheiro.size > FICHEIRO_CSV_MAXIMO) {
    mostrarResultadoCsv('O ficheiro é grande demais (máximo 5 MB). Nada foi alterado.');
    return;
  }
  let analise;
  try {
    analise = analisarCsvGastos(await ficheiro.text(), meuNome);
  } catch (erro) {
    mostrarResultadoCsv('Não foi possível ler este ficheiro. Nada foi alterado.');
    return;
  }
  if (analise.erro) {
    mostrarResultadoCsv(analise.erro);
    return;
  }
  if (analise.novas.length === 0) {
    mostrarResultadoCsv(`Nada de novo: ${partesResumoCsv(analise).join(' · ')}. Nada foi alterado.`);
    return;
  }
  mostrarResultadoCsv('');
  mostrarPreviaCsv(analise, meuNome);
}

// Sem o meu nome, nem abre o seletor de ficheiros: a app não saberia quais são os meus gastos.
botaoImportarCsv.addEventListener('click', () => {
  if (!lerNomeExportacao()) {
    fecharPreviaCsv();
    mostrarResultadoCsv('Escreve primeiro o teu nome em Definições, para a app saber quais são os teus gastos.');
    return;
  }
  campoImportarCsv.click();
});

campoImportarCsv.addEventListener('change', async (evento) => {
  const ficheiro = evento.target.files[0];
  evento.target.value = ''; // permite escolher o mesmo ficheiro outra vez
  if (ficheiro) await importarGastosCsv(ficheiro);
});

// --- Definições: "Pessoas dos gastos importados" (nome a mostrar) ---
// Só aparece com gastos importados. Uma linha por pessoa (nome original comparado com chaveTexto, como na importação):
// "No ficheiro: <nome>", o campo "Nome a mostrar" (guardado ao sair do campo) e a nota. Muda só o ecrã deste aparelho.
function desenharNomesPessoas() {
  const seccao = document.getElementById('pessoas-seccao');
  const caixa = document.getElementById('pessoas-lista');
  const pessoas = pessoasImportadas();
  seccao.hidden = pessoas.length === 0;
  // Não se redesenha enquanto se escreve num dos campos.
  if (caixa.contains(document.activeElement)) return;
  const nomes = lerNomesPessoas();
  caixa.replaceChildren(...pessoas.map((pessoa, i) => {
    const id = `pessoa-nome-${i}`;
    const campo = criar('input', {
      id,
      type: 'text',
      value: nomes[pessoa.chave] || '',
      placeholder: pessoa.nome.trim().split(/\s+/)[0],
      maxLength: NOME_A_MOSTRAR_MAXIMO,
      autocomplete: 'off',
      autocapitalize: 'words',
      enterKeyHint: 'done',
      'aria-describedby': `${id}-nota`,
    });
    campo.addEventListener('change', () => {
      const nome = limparNomeAMostrar(campo.value);
      campo.value = nome;
      const atuais = lerNomesPessoas();
      if ((atuais[pessoa.chave] || '') === nome) return;
      if (nome) atuais[pessoa.chave] = nome;
      else delete atuais[pessoa.chave];
      if (guardarNomesPessoas(atuais)) avisar(nome ? 'Nome guardado.' : 'Nome apagado: aparece o primeiro nome.');
    });
    // "OK" no teclado fecha-o, sem mais nada.
    campo.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter') campo.blur();
    });
    return criar('div', { className: 'formulario pessoa-nome-linha' },
      criar('p', { className: 'pessoa-original', textContent: `No ficheiro: ${pessoa.nome}` }),
      criar('label', { htmlFor: id }, 'Nome a mostrar', campo),
      criar('p', { id: `${id}-nota`, className: 'nota nota-campo', textContent: 'Vazio: mostra o primeiro nome.' }));
  }));
}
