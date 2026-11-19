// dados.js: guarda e carrega os dados da app no aparelho (localStorage),
// e tem pequenas funções usadas pelas outras partes da app.

const CHAVE_DADOS = 'organizador-dados';
// Campos que a app já não usa, guardados à parte para nunca se perderem (vão também na cópia de segurança completa).
const CHAVE_CAMPOS_ANTIGOS = CHAVE_DADOS + '-campos-antigos';
// Os dados tal como estavam antes da simplificação de 19 nov 2026 (só a primeira vez).
const CHAVE_ANTES_DA_SIMPLIFICACAO = CHAVE_DADOS + '-antes-da-simplificacao';
// Memória da previsão do tempo, que saiu da app: é apagada ao abrir.
const CHAVE_TEMPO_ANTIGA = 'organizador-tempo';
// Categorias das Compras, numa chave própria: começam com estas (as de sempre) e editam-se no ecrã.
const CHAVE_CATEGORIAS_COMPRAS = 'organizador-categorias-compras';
const TIPOS_COMPRAS = [
  'Frutas e legumes', 'Carne e peixe', 'Laticínios e ovos', 'Mercearia',
  'Bebidas', 'Congelados', 'Limpeza', 'Higiene', 'Outros',
];

// 4: desde 19 nov 2026, só Mercearia, Gastos e Receitas. O exercício, os suplementos, o jejum, a água, o tabaco,
// o álcool, a localidade, os limites do exercício e as notas do mês passaram para os campos antigos.
const VERSAO_DADOS = 4;

// Vista no ecrã: "mercearia" (a app abre sempre nela), "gastos", "receitas" ou "ajustes" (Definições).
let vistaAtual = 'mercearia';
// Cada vista regista aqui a função que a desenha: desenhar.mercearia(), desenhar.gastos()...
const desenhar = {};
// Funções a correr quando a app abre e sempre que volta a ficar visível.
const aoAbrir = [];
// Funções a correr quando se entra numa vista vinda de outra (ex.: a vista Gastos volta ao período de hoje).
const aoEntrar = {};

function dadosIniciais() {
  return {
    versao: VERSAO_DADOS,
    compras: [],        // { id, nome, tipo, comprar }
    tiposCompras: [],   // tipos de produto criados na app, além dos TIPOS_COMPRAS
    receitasFeitas: [], // ids das receitas marcadas como feitas esta semana (ver receitas-dados.js)
    diaInicioGastos: 21, // dia em que começa o "mês de gastos" (1 a 28); com 1, é o mês de calendário
    ultimaCopia: null,  // quando foi exportada a última cópia de segurança
    comprasFeitas: {},  // produtos dados como comprados em "Limpar comprados", por dia, ex.: { "2026-11-06": 7 }
    cartaoImportados: {}, // gastos do cartão já importados, por marca "data|comerciante|cêntimos", ex.: { "2026-11-03|continente|2350": 1 }
  };
}

// Texto sem maiúsculas nem acentos, para comparar nomes (ex.: "Maçãs" e "macas").
function chaveTexto(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Primeira letra em maiúscula; o resto do texto fica como foi escrito.
function primeiraMaiuscula(texto) {
  const limpo = texto.trim();
  return limpo.charAt(0).toLocaleUpperCase('pt-PT') + limpo.slice(1);
}

// Todas as categorias das Compras, pela ordem guardada, com "Outros" sempre em último.
function tiposDeCompras() {
  return [...categoriasCompras];
}

function novoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const eDataTexto = (t) => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t);
const eTextoCheio = (t) => typeof t === 'string' && t.trim() !== '';

// --- Campos antigos: só para converter dados e cópias de antes da simplificação ---
// Nenhuma vista os usa. Ficam em organizador-dados-campos-antigos, no formato em que a app os deixou.
const MOMENTOS_ANTIGOS = ['manha', 'almoco', 'jantar', 'noite', 'livre'];
const CAMPOS_EXERCICIO = ['ginasio', 'cycling', 'natacao', 'falhadosGinasio', 'falhadosCycling', 'falhadosNatacao', 'falhados'];
const GRUPOS_DIAS_ANTIGOS = [['jejum2r', 'jejum1r', 'jejum36h'], ['tabacoSem', 'tabacoConsumo'], ['alcoolSem', 'alcoolConsumo']];
// Todos os campos que saíram dos dados principais. "falhados" (anterior à versão 3) é convertido em "falhadosGinasio".
const CAMPOS_SIMPLIFICADOS = [
  'ginasio', 'cycling', 'natacao', 'falhadosGinasio', 'falhadosCycling', 'falhadosNatacao', 'versaoExercicio',
  'agua', 'suplementos', 'tomados', ...GRUPOS_DIAS_ANTIGOS.flat(), 'localidade', 'ajustes', 'notasMes',
];

// Exercício por categoria. Até à versão 2, cada dia tinha um só estado: ginásio, cycling, natação ou falhado
// (os falhados, numa lista "falhados", sem categoria). Na versão 3, cada categoria tem os seus dias feitos e falhados,
// independentes das outras. Migração: os dias feitos ficam na sua categoria e os falhados antigos passam para o Ginásio.
// Só lê "falhados" em dados anteriores à versão 3: correr outra vez sobre dados já migrados não muda nada.
const CATEGORIAS_DADOS_EXERCICIO = [
  { feitos: 'ginasio', falhados: 'falhadosGinasio' },
  { feitos: 'cycling', falhados: 'falhadosCycling' },
  { feitos: 'natacao', falhados: 'falhadosNatacao' },
];

function migrarExercicio(bruto, eData) {
  const lista = (nome) => (Array.isArray(bruto[nome]) ? [...new Set(bruto[nome].filter(eData))] : []);
  const antigo = !(Number.isInteger(bruto.versao) && bruto.versao >= 3);
  const resultado = {};
  CATEGORIAS_DADOS_EXERCICIO.forEach(({ feitos, falhados }) => {
    resultado[feitos] = lista(feitos);
    const origem = antigo ? (feitos === 'ginasio' ? lista('falhados') : []) : lista(falhados);
    // Na mesma categoria, um dia feito não pode estar também falhado: fica o feito.
    resultado[falhados] = origem.filter((dia) => !resultado[feitos].includes(dia));
  });
  return resultado;
}

// Campos antigos de uns dados ou de uma cópia, limpos como a app sempre os limpou. Só entram os que lá existem:
// dados sem exercício nem suplementos devolvem {}.
function normalizarCamposAntigos(bruto) {
  const tem = (campo) => Object.prototype.hasOwnProperty.call(bruto, campo);
  const antigos = {};
  if (CAMPOS_EXERCICIO.some(tem)) {
    Object.assign(antigos, migrarExercicio(bruto, eDataTexto));
    antigos.versaoExercicio = 3; // as listas acima estão no formato da versão 3
  }
  if (tem('agua')) {
    // Dados e cópias muito antigas guardavam só um dia, em { data, litros }: passa a ser uma entrada do histórico.
    const agua = bruto.agua && typeof bruto.agua === 'object' ? bruto.agua : {};
    const aguaPorDia = eDataTexto(agua.data) ? { [agua.data]: agua.litros } : agua;
    antigos.agua = {};
    Object.entries(aguaPorDia).forEach(([dia, litros]) => {
      if (eDataTexto(dia) && [0.5, 1, 1.5, 2].includes(litros)) antigos.agua[dia] = litros;
    });
  }
  if (tem('suplementos')) {
    const ids = new Set();
    antigos.suplementos = (Array.isArray(bruto.suplementos) ? bruto.suplementos : [])
      .filter((s) => s && eTextoCheio(s.nome))
      .map((s) => {
        const id = typeof s.id === 'string' && s.id && !ids.has(s.id) ? s.id : novoId();
        ids.add(id);
        return { id, nome: s.nome, momentos: MOMENTOS_ANTIGOS.filter((m) => Array.isArray(s.momentos) && s.momentos.includes(m)) };
      });
  }
  if (tem('tomados')) {
    const tomados = bruto.tomados;
    antigos.tomados = tomados && eDataTexto(tomados.data) && Array.isArray(tomados.marcados)
      ? { data: tomados.data, marcados: tomados.marcados.filter((c) => typeof c === 'string') }
      : { data: null, marcados: [] };
  }
  // Em cada grupo, um dia só fica na primeira lista em que aparecer.
  GRUPOS_DIAS_ANTIGOS.forEach((grupo) => {
    if (!grupo.some(tem)) return;
    const diasVistos = new Set();
    grupo.forEach((nome) => {
      const lista = Array.isArray(bruto[nome]) ? bruto[nome].filter(eDataTexto) : [];
      antigos[nome] = [...new Set(lista)].filter((dia) => !diasVistos.has(dia));
      antigos[nome].forEach((dia) => diasVistos.add(dia));
    });
  });
  if (tem('localidade')) {
    const local = bruto.localidade;
    antigos.localidade = local && eTextoCheio(local.nome)
      && Number.isFinite(local.latitude) && Math.abs(local.latitude) <= 90
      && Number.isFinite(local.longitude) && Math.abs(local.longitude) <= 180
      ? { nome: local.nome, regiao: typeof local.regiao === 'string' ? local.regiao : '', latitude: local.latitude, longitude: local.longitude }
      : null;
  }
  if (tem('ajustes')) {
    const ajustes = bruto.ajustes || {};
    const min = Number(ajustes.ginasioMin);
    const max = Number(ajustes.ginasioMax);
    antigos.ajustes = Number.isInteger(min) && Number.isInteger(max) && min >= 0 && max >= 1 && max <= 5 && min <= max
      ? { ginasioMin: min, ginasioMax: max }
      : { ginasioMin: 3, ginasioMax: 5 };
  }
  if (tem('notasMes')) {
    const notas = bruto.notasMes && typeof bruto.notasMes === 'object' ? bruto.notasMes : {};
    antigos.notasMes = {};
    Object.entries(notas).forEach(([mes, texto]) => {
      if (/^\d{4}-\d{2}$/.test(mes) && typeof texto === 'string' && texto.trim()) antigos.notasMes[mes] = texto;
    });
  }
  return antigos;
}

// Campos que não são dos dados atuais nem campos antigos conhecidos (ex.: "tarefas" de versões muito antigas),
// tal como estão. "app" e "exportadoEm" são só das cópias; "falhados" já foi convertido.
function camposDesconhecidos(bruto, outrosConhecidos = []) {
  const conhecidos = new Set([...Object.keys(dadosIniciais()), ...CAMPOS_SIMPLIFICADOS, 'falhados', 'app', 'exportadoEm', ...outrosConhecidos]);
  const soltos = {};
  Object.keys(bruto).forEach((campo) => { if (!conhecidos.has(campo)) soltos[campo] = bruto[campo]; });
  return soltos;
}

function lerCamposAntigosGuardados() {
  const separados = JSON.parse(localStorage.getItem(CHAVE_CAMPOS_ANTIGOS) || 'null');
  return separados && typeof separados === 'object' && !Array.isArray(separados) ? separados : {};
}

// Junta campos à chave dos campos antigos (os novos ganham aos que lá estavam com o mesmo nome). Devolve false se não
// der para guardar: nesse caso, quem chamou fica com eles (ver antigosPorGravar).
function juntarCamposAntigos(novos) {
  if (Object.keys(novos).length === 0) return true;
  try {
    let existentes = {};
    try {
      existentes = lerCamposAntigosGuardados();
    } catch (erroAoLer) {
      // Ilegível: o original fica à parte antes de se escrever por cima.
      localStorage.setItem(CHAVE_CAMPOS_ANTIGOS + '-danificados', localStorage.getItem(CHAVE_CAMPOS_ANTIGOS));
    }
    localStorage.setItem(CHAVE_CAMPOS_ANTIGOS, JSON.stringify({ ...existentes, ...novos }));
    return true;
  } catch (erro) {
    return false;
  }
}

// Limpa dados vindos de fora (do aparelho ou de uma cópia) para terem sempre a forma certa.
// Lança um erro se não parecerem dados desta app. Com "tolerante" (ao abrir a app), aceita dados sem a lista
// das compras e fica com ela vazia, em vez de perder tudo o resto. Os campos antigos tratam-se à parte.
function normalizarDados(original, tolerante = false) {
  if (!original || typeof original !== 'object' || Array.isArray(original)) throw new Error('Formato desconhecido');
  if (!tolerante && !Array.isArray(original.compras)) throw new Error('Formato desconhecido');
  const bruto = { ...original };
  if (!Array.isArray(bruto.compras)) bruto.compras = [];
  const idValido = (id) => (typeof id === 'string' && id ? id : novoId());

  const limpos = dadosIniciais();
  limpos.compras = bruto.compras
    .filter((p) => p && eTextoCheio(p.nome))
    .map((p) => ({
      id: idValido(p.id),
      nome: primeiraMaiuscula(p.nome),
      tipo: eTextoCheio(p.tipo) ? p.tipo.trim() : 'Outros',
      comprar: p.comprar === true,
    }));
  // Tipos criados na app: os guardados e os de qualquer produto, sem repetir os predefinidos.
  const tiposGuardados = Array.isArray(bruto.tiposCompras) ? bruto.tiposCompras.filter(eTextoCheio) : [];
  const tiposVistos = new Set(TIPOS_COMPRAS.map(chaveTexto));
  [...tiposGuardados.map((t) => t.trim()), ...limpos.compras.map((p) => p.tipo)].forEach((tipo) => {
    if (tiposVistos.has(chaveTexto(tipo))) return;
    tiposVistos.add(chaveTexto(tipo));
    limpos.tiposCompras.push(tipo);
  });

  // Dados e cópias anteriores às receitas não têm esta lista: fica vazia.
  const receitasFeitas = Array.isArray(bruto.receitasFeitas) ? bruto.receitasFeitas.filter(eTextoCheio) : [];
  limpos.receitasFeitas = [...new Set(receitasFeitas)];

  // Dados e cópias anteriores a esta definição ficam com o dia 21 (o ordenado entra a 21).
  if (Number.isInteger(bruto.diaInicioGastos) && bruto.diaInicioGastos >= 1 && bruto.diaInicioGastos <= 28) {
    limpos.diaInicioGastos = bruto.diaInicioGastos;
  }
  if (typeof bruto.ultimaCopia === 'string' && !Number.isNaN(Date.parse(bruto.ultimaCopia))) {
    limpos.ultimaCopia = bruto.ultimaCopia;
  }
  const feitas = bruto.comprasFeitas && typeof bruto.comprasFeitas === 'object' ? bruto.comprasFeitas : {};
  Object.entries(feitas).forEach(([dia, numero]) => {
    if (eDataTexto(dia) && Number.isInteger(numero) && numero > 0) limpos.comprasFeitas[dia] = numero;
  });
  // Dados e cópias anteriores à importação do cartão não têm esta lista: fica vazia.
  const cartao = bruto.cartaoImportados && typeof bruto.cartaoImportados === 'object' ? bruto.cartaoImportados : {};
  Object.entries(cartao).forEach(([marca, numero]) => {
    if (marca && Number.isInteger(numero) && numero > 0) limpos.cartaoImportados[marca] = numero;
  });
  return limpos;
}

// Aviso mostrado uma vez, ao abrir a app depois da simplificação; null se não houve nada a passar.
let avisoMigracao = null;
// Campos antigos que não deu para guardar na chave própria (ex.: sem espaço): continuam a ir com os dados principais,
// para não se perderem, até ser possível guardá-los à parte (ver guardarDados).
let antigosPorGravar = {};
let dadosPorGravar = false;

function carregarDados() {
  let texto = null;
  try {
    texto = localStorage.getItem(CHAVE_DADOS);
    if (!texto) return dadosIniciais();
    const bruto = JSON.parse(texto);
    const limpos = normalizarDados(bruto, true);
    const antigos = { ...camposDesconhecidos(bruto), ...normalizarCamposAntigos(bruto) };
    if (Object.keys(antigos).length > 0 || bruto.versao !== VERSAO_DADOS) {
      // Antes de mexer, guarda os dados tal como estavam (só a primeira vez, para nunca se perder o original).
      // Uma falha aqui (ex.: sem espaço) não pode fazer os dados parecer danificados: segue sem esta cópia.
      try {
        if (Object.keys(antigos).length > 0 && localStorage.getItem(CHAVE_ANTES_DA_SIMPLIFICACAO) === null) {
          localStorage.setItem(CHAVE_ANTES_DA_SIMPLIFICACAO, texto);
        }
        // Dados anteriores à versão 3 do exercício: a cópia de sempre, também só a primeira vez.
        if (CAMPOS_EXERCICIO.some((c) => c in bruto) && !(Number.isInteger(bruto.versao) && bruto.versao >= 3)
          && localStorage.getItem(CHAVE_DADOS + '-antes-da-migracao') === null) {
          localStorage.setItem(CHAVE_DADOS + '-antes-da-migracao', texto);
        }
      } catch (erroAoGuardar) { /* sem espaço: o original continua nas cópias de segurança exportadas */ }
      if (!juntarCamposAntigos(antigos)) antigosPorGravar = antigos;
      if (CAMPOS_SIMPLIFICADOS.some((c) => c in antigos)) {
        avisoMigracao = 'App simplificada: o exercício, os suplementos e o jejum já não aparecem, mas os dados continuam guardados e vão na cópia de segurança.';
      }
      dadosPorGravar = true;
    }
    return limpos;
  } catch (erro) {
    // Dados ilegíveis: guardamos o original à parte para não se perder ao gravar por cima.
    try {
      if (texto) localStorage.setItem(CHAVE_DADOS + '-danificados', texto);
    } catch (erroAoGuardar) { /* sem espaço ou sem acesso: não há mais nada a fazer */ }
    return dadosIniciais();
  }
}

let dados = carregarDados();
// A passagem para o formato novo fica logo guardada, para correr uma só vez.
if (dadosPorGravar) guardarDados();
// A previsão do tempo saiu da app: a memória dela já não serve.
try {
  localStorage.removeItem(CHAVE_TEMPO_ANTIGA);
} catch (erro) { /* sem acesso: não faz mal */ }

// --- Categorias das Compras (chave organizador-categorias-compras) ---
// Lista limpa: só textos, sem repetidos (sem contar maiúsculas e acentos) e com "Outros" no fim.
function normalizarCategoriasCompras(lista) {
  const vistas = new Set([chaveTexto('Outros')]);
  const limpas = [];
  lista.forEach((nome) => {
    if (typeof nome !== 'string' || !nome.trim()) return;
    const limpo = nome.replace(/\s+/g, ' ').trim();
    if (vistas.has(chaveTexto(limpo))) return;
    vistas.add(chaveTexto(limpo));
    limpas.push(limpo);
  });
  return [...limpas, 'Outros'];
}

// Junta as categorias que os dados usam e ainda não estão na lista (ex.: depois de importar uma cópia),
// antes de "Outros", para nenhum produto ficar sem a sua categoria. Não muda o tipo de nenhum produto.
function completarCategoriasCompras(lista) {
  const conhecidas = new Set(lista.map(chaveTexto));
  const novas = [];
  [...dados.tiposCompras, ...dados.compras.map((p) => p.tipo)].forEach((tipo) => {
    if (conhecidas.has(chaveTexto(tipo))) return;
    conhecidas.add(chaveTexto(tipo));
    novas.push(tipo);
  });
  if (novas.length === 0) return lista;
  return normalizarCategoriasCompras([...lista.slice(0, -1), ...novas]);
}

// Na primeira vez, a lista começa com as categorias de sempre e as criadas antes nesta app, pela mesma ordem.
function carregarCategoriasCompras() {
  let texto = null;
  try {
    texto = localStorage.getItem(CHAVE_CATEGORIAS_COMPRAS);
    if (texto) {
      const bruto = JSON.parse(texto);
      if (!Array.isArray(bruto.categorias)) throw new Error('Formato desconhecido');
      return completarCategoriasCompras(normalizarCategoriasCompras(bruto.categorias));
    }
  } catch (erro) {
    try {
      if (texto) localStorage.setItem(CHAVE_CATEGORIAS_COMPRAS + '-danificados', texto);
    } catch (erroAoGuardar) { /* sem espaço ou sem acesso */ }
  }
  return completarCategoriasCompras(normalizarCategoriasCompras(TIPOS_COMPRAS.filter((tipo) => tipo !== 'Outros')));
}

let categoriasCompras = carregarCategoriasCompras();

function guardarCategoriasCompras() {
  try {
    localStorage.setItem(CHAVE_CATEGORIAS_COMPRAS, JSON.stringify({ versao: 1, categorias: categoriasCompras }));
  } catch (erro) {
    avisar('Não foi possível guardar. Exporta uma cópia de segurança.');
  }
}
// Na primeira vez, a lista inicial fica logo guardada no aparelho.
try {
  if (!localStorage.getItem(CHAVE_CATEGORIAS_COMPRAS)) guardarCategoriasCompras();
} catch (erro) { /* sem acesso: a lista volta a ser feita da mesma forma da próxima vez */ }

// "tiposCompras" (nos dados de sempre) continua a ter as categorias que não são as predefinidas,
// para as cópias antigas e para a app voltar a encontrá-las.
function acertarTiposCompras() {
  const predefinidas = new Set(TIPOS_COMPRAS.map(chaveTexto));
  dados.tiposCompras = categoriasCompras.filter((tipo) => !predefinidas.has(chaveTexto(tipo)));
}

// Devolve a categoria tal como a app a conhece; se for nova, passa a existir, no fim da lista (antes de "Outros").
function garantirCategoriaCompras(nome) {
  const conhecida = categoriasCompras.find((tipo) => chaveTexto(tipo) === chaveTexto(nome));
  if (conhecida) return conhecida;
  const limpo = primeiraMaiuscula(nome.replace(/\s+/g, ' '));
  categoriasCompras = normalizarCategoriasCompras([...categoriasCompras.slice(0, -1), limpo]);
  if (!dados.tiposCompras.some((tipo) => chaveTexto(tipo) === chaveTexto(limpo))) dados.tiposCompras.push(limpo);
  guardarCategoriasCompras();
  return limpo;
}

function guardarDados() {
  // Campos antigos ainda por guardar à parte: tenta outra vez; se não der, vão com os dados principais.
  if (Object.keys(antigosPorGravar).length > 0 && juntarCamposAntigos(antigosPorGravar)) antigosPorGravar = {};
  try {
    localStorage.setItem(CHAVE_DADOS, JSON.stringify({ ...antigosPorGravar, ...dados }));
  } catch (erro) {
    avisar('Não foi possível guardar. Exporta uma cópia de segurança.');
  }
}

// --- Mensagem curta no fundo do ecrã ---
let temporizadorAviso;
function avisar(mensagem) {
  const aviso = document.getElementById('aviso');
  aviso.textContent = mensagem;
  aviso.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { aviso.hidden = true; }, 4000);
}

// --- Datas: sempre na hora local, em texto "AAAA-MM-DD" ---
function dataParaTexto(data) {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function textoParaData(texto) {
  const [ano, mes, dia] = texto.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

function formatarData(data, opcoes) {
  return data.toLocaleDateString('pt-PT', opcoes);
}

const MESES_ABREVIADOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Ex.: "2026-11-12" passa a "12 nov".
function dataAbreviada(texto) {
  const data = textoParaData(texto);
  return `${data.getDate()} ${MESES_ABREVIADOS[data.getMonth()]}`;
}

// --- Criar elementos no ecrã ---
// Corre uma função de desenho sem deixar um erro apagar o resto do ecrã.
function correrSemFalhar(funcao) {
  try {
    funcao();
  } catch (erro) {
    console.error(erro);
    avisar('Algo correu mal ao mostrar esta parte. Os dados guardados não foram alterados.');
  }
}

// Usa textContent (nunca innerHTML), para o texto escrito aparecer sempre como simples texto.
function criar(etiqueta, propriedades = {}, ...filhos) {
  const elemento = document.createElement(etiqueta);
  Object.entries(propriedades).forEach(([nome, valor]) => {
    if (nome.startsWith('aria-') || nome === 'type') elemento.setAttribute(nome, valor);
    else elemento[nome] = valor;
  });
  elemento.append(...filhos);
  return elemento;
}

function botaoApagar(descricao, aoTocar) {
  return criar('button', {
    type: 'button',
    className: 'botao-apagar',
    textContent: '✕',
    'aria-label': `Apagar ${descricao}`,
    onclick: aoTocar,
  });
}
