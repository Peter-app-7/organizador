// exportar-csv.js: "Exportar (CSV)", no topo da vista Gastos (aria-label "Exportar gastos (CSV)"), e o nome para a coluna "pessoa" (em Definições).
// Exporta todos os períodos: os registos de "Registar compras" e os gastos gerais (incluindo os do cartão), cada um uma
// vez, do mais antigo para o mais recente. Ficheiro gastos-AAAA-MM-DD.csv, UTF-8 com BOM, separado por ";", com o cabeçalho
// id;data;periodo;pessoa;origem;categoria;descricao;comerciante;valor

// O nome fica só neste aparelho, numa chave própria, e vai na cópia de segurança em "preferencias.nomeExportacao".
const CHAVE_NOME_EXPORTACAO = 'organizador-nome-exportacao';
const NOME_EXPORTACAO_MAXIMO = 60; // letras
const CABECALHO_CSV = ['id', 'data', 'periodo', 'pessoa', 'origem', 'categoria', 'descricao', 'comerciante', 'valor'];

function limparNomeExportacao(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim().slice(0, NOME_EXPORTACAO_MAXIMO);
}

function lerNomeExportacao() {
  try {
    return limparNomeExportacao(localStorage.getItem(CHAVE_NOME_EXPORTACAO));
  } catch (erro) {
    return '';
  }
}

// Vazio apaga a chave (fica como por defeito). Devolve false se não der para guardar.
function guardarNomeExportacao(nome) {
  try {
    if (nome) localStorage.setItem(CHAVE_NOME_EXPORTACAO, nome);
    else localStorage.removeItem(CHAVE_NOME_EXPORTACAO);
    return true;
  } catch (erro) {
    avisar('Não foi possível guardar. Exporta uma cópia de segurança.');
    return false;
  }
}

const campoNomeExportacao = document.getElementById('ajuste-nome-exportacao');

function desenharNomeExportacao() {
  if (document.activeElement !== campoNomeExportacao) campoNomeExportacao.value = lerNomeExportacao();
}

campoNomeExportacao.addEventListener('change', () => {
  const nome = limparNomeExportacao(campoNomeExportacao.value);
  campoNomeExportacao.value = nome;
  if (nome === lerNomeExportacao()) return;
  if (guardarNomeExportacao(nome)) avisar(nome ? 'Nome guardado.' : 'Nome apagado.');
});
// "OK" no teclado fecha-o, sem mais nada.
campoNomeExportacao.addEventListener('keydown', (evento) => {
  if (evento.key === 'Enter') campoNomeExportacao.blur();
});

// --- O ficheiro ---
// Ex.: 1230 passa a "12,30" e 9999999 a "99999,99": sem € nem separador de milhares, para as folhas de cálculo.
function valorCsv(centimos) {
  return `${Math.floor(centimos / 100)},${String(centimos % 100).padStart(2, '0')}`;
}

// Campos com ";", aspas ou quebras de linha ficam entre aspas, com as aspas de dentro repetidas.
function campoCsv(texto) {
  const valor = String(texto);
  return /[;"\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

// Na coluna "pessoa" vai sempre o nome original (gasto.pessoa), nunca o nome a mostrar das Definições.
// Id do gasto no ficheiro. Os gastos de outra pessoa saem com o id original, o do ficheiro dela (a parte do csvMarca
// "pessoaNormalizada|id" depois da pessoa), e não com o id deste telemóvel: assim, reimportar este ficheiro (aqui ou
// noutro telemóvel que já tenha os gastos dela) dá "já importados" em vez de os duplicar. Serve também para os gastos
// importados antes desta correção, porque todos têm o csvMarca. Os meus saem como sempre: "c-" ou "d-" + id.
function idCsvDoGasto(g) {
  const marca = g.origem === 'despesa' ? g.registo.csvMarca : '';
  if (marca && g.pessoa) {
    const prefixo = `${chaveTexto(g.pessoa)}|`;
    const original = marca.startsWith(prefixo) ? marca.slice(prefixo.length) : marca.slice(marca.indexOf('|') + 1);
    if (original.trim()) return original;
  }
  return `${g.origem === 'compras' ? 'c' : 'd'}-${g.id}`;
}

// Uma linha por registo, já pela ordem do ficheiro. Usa os mesmos registos do total do mês (todosOsGastos, em despesas.js).
// Os gastos de outra pessoa (importados de um CSV, ver importar-csv.js) saem com o nome e a origem dela: assim, quando
// ela importa este ficheiro, reconhece-os como seus e ignora-os.
function linhasCsvGastos() {
  const meuNome = lerNomeExportacao();
  return todosOsGastos()
    // Do mais antigo para o mais recente; no mesmo dia, pela ordem em que foram registados (os ids começam pela hora).
    .sort((a, b) => a.data.localeCompare(b.data) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((g) => {
      const compras = g.origem === 'compras';
      return [
        idCsvDoGasto(g),
        g.data,
        periodoDaData(g.data).chave,
        g.pessoa || meuNome,
        compras ? 'compras' : (g.registo.origemOriginal || (g.registo.cartao ? 'cartao' : 'manual')),
        nomeCategoriaDespesa(g.categoria), // nos registos de compras, o nome atual da Mercearia
        g.nota || '',
        compras ? '' : (g.registo.comerciante || ''),
        valorCsv(g.centimos),
      ];
    });
}

function textoCsvGastos(linhas) {
  return `﻿${[CABECALHO_CSV, ...linhas].map((linha) => linha.map(campoCsv).join(';')).join('\r\n')}\r\n`;
}

async function exportarGastosCsv() {
  const linhas = linhasCsvGastos();
  if (linhas.length === 0) {
    mostrarResultadoGastos('Ainda não há gastos para exportar.');
    return;
  }
  const ficheiro = new File([textoCsvGastos(linhas)], `gastos-${dataParaTexto(new Date())}.csv`, { type: 'text/csv' });
  if (!(await partilharFicheiro(ficheiro))) return;
  mostrarResultadoGastos(`${linhas.length} ${linhas.length === 1 ? 'gasto exportado' : 'gastos exportados'}.`);
}

document.getElementById('gastos-exportar-csv').addEventListener('click', exportarGastosCsv);
