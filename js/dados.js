// dados.js: guarda e carrega os dados da app no aparelho (localStorage),
// e tem pequenas funções usadas pelas outras partes da app.

const CHAVE_DADOS = 'organizador-dados';
const TIPOS_COMPRAS = [
  'Frutas e legumes', 'Carne e peixe', 'Laticínios e ovos', 'Mercearia',
  'Bebidas', 'Congelados', 'Limpeza', 'Higiene', 'Outros',
];

const MOMENTOS = [
  { id: 'manha', nome: 'Manhã', letra: 'M' },
  { id: 'almoco', nome: 'Almoço', letra: 'A' },
  { id: 'jantar', nome: 'Jantar', letra: 'J' },
  { id: 'noite', nome: 'Noite', letra: 'N' },
  { id: 'livre', nome: 'Horário livre', letra: 'L' }, // sem hora marcada: não se junta aos outros momentos
];

// Cada vista regista aqui a função que a desenha: desenhar.semana(), desenhar.compras()...
const desenhar = {};
// Funções a correr quando a app abre e sempre que volta a ficar visível.
const aoAbrir = [];

function dadosIniciais() {
  return {
    versao: 2,
    ginasio: [],        // dias marcados, ex.: "2026-11-02"
    cycling: [],        // dias de cycling, no mesmo formato
    falhados: [],       // dias de exercício falhado, no mesmo formato; um dia só está numa das três listas
    agua: {},           // litros de água por dia, ex.: { "2026-11-02": 1.5 }; sem água, o dia não aparece
    compras: [],        // { id, nome, tipo, comprar }
    tiposCompras: [],   // tipos de produto criados na app, além dos TIPOS_COMPRAS
    receitasFeitas: [], // ids das receitas marcadas como feitas esta semana (ver receitas-dados.js)
    suplementos: [],    // { id, nome, momentos: ["manha", "noite", ...] } ou { ..., momentos: ["livre"] }
    tomados: { data: null, marcados: [] }, // marcas do dia indicado em "data"
    jejum2r: [],        // dias de jejum, por tipo, como os dias de ginásio; um dia só está numa das três listas
    jejum1r: [],
    jejum36h: [],
    tabacoSem: [],      // dias sem tabaco e dias com consumo; um dia só está numa das duas listas
    tabacoConsumo: [],
    alcoolSem: [],      // o mesmo para o álcool, sem depender do tabaco
    alcoolConsumo: [],
    localidade: null,   // { nome, regiao, latitude, longitude }, escolhida em Definições
    ajustes: { ginasioMin: 3, ginasioMax: 5 },
    ultimaCopia: null,  // quando foi exportada a última cópia de segurança
    notasMes: {},       // notas da revisão mensal, por mês, ex.: { "2026-11": "Correu bem..." }
    comprasFeitas: {},  // produtos dados como comprados em "Limpar comprados", por dia, ex.: { "2026-11-06": 7 }
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

// Todos os tipos de produto, com "Outros" sempre em último.
function tiposDeCompras() {
  return [
    ...TIPOS_COMPRAS.filter((tipo) => tipo !== 'Outros'),
    ...dados.tiposCompras,
    'Outros',
  ];
}

function novoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Limpa dados vindos de fora (do aparelho ou de uma cópia) para terem sempre a forma certa.
// Lança um erro se não parecerem dados desta app. Com "tolerante" (ao abrir a app), aceita dados
// a que falte alguma lista e fica com ela vazia, em vez de perder tudo o resto.
function normalizarDados(original, tolerante = false) {
  const listas = ['ginasio', 'compras'];
  if (!original || typeof original !== 'object' || Array.isArray(original)) throw new Error('Formato desconhecido');
  if (!tolerante && !listas.every((nome) => Array.isArray(original[nome]))) throw new Error('Formato desconhecido');
  const bruto = { ...original };
  listas.forEach((nome) => { if (!Array.isArray(bruto[nome])) bruto[nome] = []; });

  const eData = (t) => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t);
  const eTexto = (t) => typeof t === 'string' && t.trim() !== '';
  const idValido = (id) => (typeof id === 'string' && id ? id : novoId());

  const limpos = dadosIniciais();
  limpos.ginasio = [...new Set(bruto.ginasio.filter(eData))];
  const cycling = Array.isArray(bruto.cycling) ? bruto.cycling.filter(eData) : [];
  limpos.cycling = [...new Set(cycling)].filter((dia) => !limpos.ginasio.includes(dia));
  const falhados = Array.isArray(bruto.falhados) ? bruto.falhados.filter(eData) : [];
  limpos.falhados = [...new Set(falhados)]
    .filter((dia) => !limpos.ginasio.includes(dia) && !limpos.cycling.includes(dia));
  // Dados e cópias antigas guardavam só um dia, em { data, litros }: passa a ser uma entrada do histórico.
  const agua = bruto.agua && typeof bruto.agua === 'object' ? bruto.agua : {};
  const aguaPorDia = eData(agua.data) ? { [agua.data]: agua.litros } : agua;
  Object.entries(aguaPorDia).forEach(([dia, litros]) => {
    if (eData(dia) && [0.5, 1, 1.5, 2].includes(litros)) limpos.agua[dia] = litros;
  });
  limpos.compras = bruto.compras
    .filter((p) => p && eTexto(p.nome))
    .map((p) => ({
      id: idValido(p.id),
      nome: primeiraMaiuscula(p.nome),
      tipo: eTexto(p.tipo) ? p.tipo.trim() : 'Outros',
      comprar: p.comprar === true,
    }));
  // Tipos criados na app: os guardados e os de qualquer produto, sem repetir os predefinidos.
  const tiposGuardados = Array.isArray(bruto.tiposCompras) ? bruto.tiposCompras.filter(eTexto) : [];
  const tiposVistos = new Set(TIPOS_COMPRAS.map(chaveTexto));
  [...tiposGuardados.map((t) => t.trim()), ...limpos.compras.map((p) => p.tipo)].forEach((tipo) => {
    if (tiposVistos.has(chaveTexto(tipo))) return;
    tiposVistos.add(chaveTexto(tipo));
    limpos.tiposCompras.push(tipo);
  });

  // Dados e cópias anteriores às receitas não têm esta lista: fica vazia.
  const receitasFeitas = Array.isArray(bruto.receitasFeitas) ? bruto.receitasFeitas.filter(eTexto) : [];
  limpos.receitasFeitas = [...new Set(receitasFeitas)];

  // Dados e cópias anteriores a esta funcionalidade não têm suplementos: fica a lista vazia.
  const suplementos = Array.isArray(bruto.suplementos) ? bruto.suplementos : [];
  limpos.suplementos = suplementos
    .filter((s) => s && eTexto(s.nome))
    .map((s) => ({
      id: idValido(s.id),
      nome: s.nome,
      momentos: MOMENTOS.map((m) => m.id).filter((id) => Array.isArray(s.momentos) && s.momentos.includes(id)),
    }));
  const tomados = bruto.tomados;
  if (tomados && eData(tomados.data) && Array.isArray(tomados.marcados)) {
    limpos.tomados = { data: tomados.data, marcados: tomados.marcados.filter((c) => typeof c === 'string') };
  }

  // Dados e cópias anteriores a estas listas ficam com elas vazias. Em cada grupo, um dia só fica na primeira lista em que aparecer.
  [['jejum2r', 'jejum1r', 'jejum36h'], ['tabacoSem', 'tabacoConsumo'], ['alcoolSem', 'alcoolConsumo']].forEach((grupo) => {
    const diasVistos = new Set();
    grupo.forEach((nome) => {
      const lista = Array.isArray(bruto[nome]) ? bruto[nome].filter(eData) : [];
      limpos[nome] = [...new Set(lista)].filter((dia) => !diasVistos.has(dia));
      limpos[nome].forEach((dia) => diasVistos.add(dia));
    });
  });

  const local = bruto.localidade;
  if (local && eTexto(local.nome)
    && Number.isFinite(local.latitude) && Math.abs(local.latitude) <= 90
    && Number.isFinite(local.longitude) && Math.abs(local.longitude) <= 180) {
    limpos.localidade = {
      nome: local.nome,
      regiao: typeof local.regiao === 'string' ? local.regiao : '',
      latitude: local.latitude,
      longitude: local.longitude,
    };
  }

  const ajustes = bruto.ajustes || {};
  const min = Number(ajustes.ginasioMin);
  const max = Number(ajustes.ginasioMax);
  if (Number.isInteger(min) && Number.isInteger(max) && min >= 0 && max >= 1 && max <= 5 && min <= max) {
    limpos.ajustes = { ginasioMin: min, ginasioMax: max };
  }
  if (typeof bruto.ultimaCopia === 'string' && !Number.isNaN(Date.parse(bruto.ultimaCopia))) {
    limpos.ultimaCopia = bruto.ultimaCopia;
  }

  // Dados e cópias anteriores à vista Mês não têm notas nem histórico de compras: ficam vazios.
  const notas = bruto.notasMes && typeof bruto.notasMes === 'object' ? bruto.notasMes : {};
  Object.entries(notas).forEach(([mes, texto]) => {
    if (/^\d{4}-\d{2}$/.test(mes) && typeof texto === 'string' && texto.trim()) limpos.notasMes[mes] = texto;
  });
  const feitas = bruto.comprasFeitas && typeof bruto.comprasFeitas === 'object' ? bruto.comprasFeitas : {};
  Object.entries(feitas).forEach(([dia, numero]) => {
    if (eData(dia) && Number.isInteger(numero) && numero > 0) limpos.comprasFeitas[dia] = numero;
  });
  return limpos;
}

function carregarDados() {
  let texto = null;
  try {
    texto = localStorage.getItem(CHAVE_DADOS);
    return texto ? normalizarDados(JSON.parse(texto), true) : dadosIniciais();
  } catch (erro) {
    // Dados ilegíveis: guardamos o original à parte para não se perder ao gravar por cima.
    try {
      if (texto) localStorage.setItem(CHAVE_DADOS + '-danificados', texto);
    } catch (erroAoGuardar) { /* sem espaço ou sem acesso: não há mais nada a fazer */ }
    return dadosIniciais();
  }
}

let dados = carregarDados();

function guardarDados() {
  try {
    localStorage.setItem(CHAVE_DADOS, JSON.stringify(dados));
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
