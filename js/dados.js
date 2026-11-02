// dados.js: guarda e carrega os dados da app no aparelho (localStorage),
// e tem pequenas funções usadas pelas outras partes da app.

const CHAVE_DADOS = 'organizador-dados';
const TIPOS_COMPRAS = [
  'Frutas e legumes', 'Carne e peixe', 'Laticínios e ovos', 'Mercearia',
  'Bebidas', 'Congelados', 'Limpeza', 'Higiene', 'Outros',
];

const MOMENTOS = [
  { id: 'manha', nome: 'Manhã' },
  { id: 'almoco', nome: 'Almoço' },
  { id: 'jantar', nome: 'Jantar' },
  { id: 'noite', nome: 'Noite' },
];

// Cada vista regista aqui a função que a desenha: desenhar.semana(), desenhar.compras()...
const desenhar = {};
// Funções a correr quando a app abre e sempre que volta a ficar visível.
const aoAbrir = [];

function dadosIniciais() {
  return {
    versao: 1,
    ginasio: [],        // dias marcados, ex.: "2026-11-02"
    cycling: [],        // dias de cycling, no mesmo formato; um dia nunca está nas duas listas
    agua: { data: null, litros: 0 }, // água do dia indicado em "data"
    tarefas: [],        // { id, texto, feita }
    compras: [],        // { id, nome, tipo, comprar }
    tiposCompras: [],   // tipos de produto criados na app, além dos TIPOS_COMPRAS
    suplementos: [],    // { id, nome, momentos: ["manha", "noite", ...] }
    tomados: { data: null, marcados: [] }, // marcas do dia indicado em "data"
    localidade: null,   // { nome, regiao, latitude, longitude }, escolhida em Definições
    ajustes: { ginasioMin: 3, ginasioMax: 5 },
    ultimaCopia: null,  // quando foi exportada a última cópia de segurança
  };
}

// Texto sem maiúsculas nem acentos, para comparar nomes (ex.: "Maçãs" e "macas").
function chaveTexto(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
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
// Lança um erro se não parecerem dados desta app.
function normalizarDados(bruto) {
  const listas = ['ginasio', 'tarefas', 'compras'];
  if (!bruto || typeof bruto !== 'object' || !listas.every((nome) => Array.isArray(bruto[nome]))) {
    throw new Error('Formato desconhecido');
  }

  const eData = (t) => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t);
  const eTexto = (t) => typeof t === 'string' && t.trim() !== '';
  const idValido = (id) => (typeof id === 'string' && id ? id : novoId());

  const limpos = dadosIniciais();
  limpos.ginasio = [...new Set(bruto.ginasio.filter(eData))];
  const cycling = Array.isArray(bruto.cycling) ? bruto.cycling.filter(eData) : [];
  limpos.cycling = [...new Set(cycling)].filter((dia) => !limpos.ginasio.includes(dia));
  const agua = bruto.agua;
  if (agua && eData(agua.data) && [0, 0.5, 1, 1.5, 2].includes(agua.litros)) {
    limpos.agua = { data: agua.data, litros: agua.litros };
  }
  limpos.tarefas = bruto.tarefas
    .filter((t) => t && eTexto(t.texto))
    .map((t) => ({ id: idValido(t.id), texto: t.texto, feita: t.feita === true }));
  limpos.compras = bruto.compras
    .filter((p) => p && eTexto(p.nome))
    .map((p) => ({
      id: idValido(p.id),
      nome: p.nome,
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
  if (typeof bruto.ultimaCopia === 'string') limpos.ultimaCopia = bruto.ultimaCopia;
  return limpos;
}

function carregarDados() {
  let texto = null;
  try {
    texto = localStorage.getItem(CHAVE_DADOS);
    return texto ? normalizarDados(JSON.parse(texto)) : dadosIniciais();
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
