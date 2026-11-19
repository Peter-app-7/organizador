// casa.js: lista partilhada da Mercearia entre dois telemóveis, com um "código da casa" (Definições).
// Só se partilham os produtos (nome, categoria e sim/não) e as categorias das Compras. Tudo o resto fica só no aparelho.
//
// O localStorage continua a ser a fonte do ecrã: a app abre e funciona sem rede, e a nuvem é só um espelho.
// Sem casa ligada, nada disto faz pedidos à internet e o Firebase nem é carregado (ver nuvem.js).
//
// Como funciona:
// - Depois de cada gravação (guardarDados e guardarCategoriasCompras, em dados.js), notarMudancasCompras compara a lista
//   com o "espelho" (o que a nuvem já sabe) e põe na fila (pendentes) os produtos novos, mudados ou apagados.
// - Cada alteração tem uma marca "editadoEm" (milissegundos x 1000 + um número ao acaso, nunca abaixo da maior já vista):
//   em cada produto ganha a alteração mais recente, nos dois aparelhos.
// - A fila fica no localStorage (organizador-casa-sincronizacao): sem rede, ou com a app fechada, as alterações esperam
//   e seguem quando houver internet. O Firestore também as guarda na sua cache (IndexedDB), quando a tem.
// - Apagar um produto deixa na nuvem uma marca (apagado: true), para o outro aparelho o apagar também;
//   as marcas com mais de 60 dias são limpas.

const CHAVE_CASA = 'organizador-casa'; // só o código; nunca vai na cópia de segurança
const CHAVE_CASA_SINCRONIZACAO = 'organizador-casa-sincronizacao'; // fila e espelho; também fica fora das cópias
const CHAVE_COMPRAS_ANTES_DA_CASA = 'organizador-compras-antes-da-casa'; // a lista antes da primeira ligação (só uma vez)

// Sem 0, 1, i, l e o, para não se confundirem ao passar o código à mão.
const ALFABETO_CASA = '23456789abcdefghjkmnpqrstuvwxyz';
const LETRAS_DO_CODIGO = 24; // em 6 grupos de 4, ex.: "k7vq-3mzx-…"
const NOME_MAXIMO_NUVEM = 100;
const TIPO_MAXIMO_NUVEM = 50;
const CATEGORIAS_MAXIMAS_NUVEM = 40;
const DIAS_MARCAS_APAGADAS = 60;
const DIA_EM_MS = 24 * 60 * 60 * 1000;
const URL_NUVEM = new URL('nuvem.js', document.currentScript.src).href;

// --- Código da casa ---
function gerarCodigoCasa() {
  const letras = [];
  // Só aceita bytes abaixo do maior múltiplo do alfabeto, para todas as letras terem a mesma probabilidade.
  const limite = 256 - (256 % ALFABETO_CASA.length);
  while (letras.length < LETRAS_DO_CODIGO) {
    const bytes = new Uint8Array(LETRAS_DO_CODIGO * 2);
    crypto.getRandomValues(bytes);
    bytes.forEach((b) => { if (b < limite && letras.length < LETRAS_DO_CODIGO) letras.push(ALFABETO_CASA[b % ALFABETO_CASA.length]); });
  }
  return letras.join('').match(/.{4}/g).join('-');
}

// Aceita o código com ou sem traços, espaços ou maiúsculas. Devolve null se não for válido.
function normalizarCodigoCasa(texto) {
  const limpo = String(texto || '').toLowerCase().replace(/\s+/g, '');
  const semTracos = limpo.replace(/-/g, '');
  if (semTracos.length === LETRAS_DO_CODIGO && [...semTracos].every((c) => ALFABETO_CASA.includes(c))) {
    return semTracos.match(/.{4}/g).join('-');
  }
  return /^[a-z0-9-]{20,64}$/.test(limpo) ? limpo : null;
}

function lerCodigoCasa() {
  try {
    return normalizarCodigoCasa(localStorage.getItem(CHAVE_CASA));
  } catch (erro) {
    return null;
  }
}

// --- Estado da sincronização (organizador-casa-sincronizacao) ---
// espelho: { id: { nome, tipo, comprar } } = o que a nuvem já tem (ou vai ter) de cada produto;
// editados: { id: editadoEm }; apagados: { id: { nome, tipo, editadoEm } }; pendentes: { id: true } = por enviar;
// categorias: { espelho: [...], editadoEm, pendente }; precisaJuntar: juntar com a nuvem antes de enviar (ver juntarComRemoto).
function estadoSincronizacaoVazio() {
  return {
    versao: 1, relogio: 0, espelho: {}, editados: {}, apagados: {}, pendentes: {},
    categorias: { espelho: null, editadoEm: 0, pendente: false }, precisaJuntar: false,
  };
}

function lerEstadoSincronizacao() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE_CASA_SINCRONIZACAO) || 'null');
    const objeto = (v) => v && typeof v === 'object' && !Array.isArray(v);
    if (objeto(bruto) && bruto.versao === 1 && ['espelho', 'editados', 'apagados', 'pendentes'].every((c) => objeto(bruto[c]))) {
      const vazio = estadoSincronizacaoVazio();
      return { ...vazio, ...bruto, categorias: { ...vazio.categorias, ...(objeto(bruto.categorias) ? bruto.categorias : {}) } };
    }
  } catch (erro) { /* ilegível: junta-se outra vez com a nuvem, sem perder nada deste aparelho */ }
  return null;
}

let codigoCasa = lerCodigoCasa();
let sincronizacao = null;
if (codigoCasa) {
  sincronizacao = lerEstadoSincronizacao();
  // Sem estado (ex.: ilegível), não se sabe o que a nuvem já tem: junta-se outra vez, como ao entrar na casa.
  if (!sincronizacao) sincronizacao = { ...estadoSincronizacaoVazio(), precisaJuntar: true };
}

function guardarEstadoSincronizacao() {
  if (!sincronizacao) return;
  try {
    localStorage.setItem(CHAVE_CASA_SINCRONIZACAO, JSON.stringify(sincronizacao));
  } catch (erro) { /* sem espaço: a fila continua em memória enquanto a app estiver aberta */ }
}

function marcaDeTempo() {
  const agora = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  sincronizacao.relogio = Math.max(agora, sincronizacao.relogio + 1);
  return sincronizacao.relogio;
}

function verMarca(editadoEm) {
  if (editadoEm > sincronizacao.relogio) sincronizacao.relogio = editadoEm;
}

const valorProduto = (p) => ({ nome: p.nome, tipo: p.tipo, comprar: p.comprar });
const mesmoValor = (a, b) => Boolean(a && b) && a.nome === b.nome && a.tipo === b.tipo && a.comprar === b.comprar;
const cortar = (texto, maximo, seVazio) => (String(texto || '').trim().slice(0, maximo) || seVazio);

// --- Ver o que mudou na lista e pôr na fila ---
let sincronizacaoEmPausa = false;

function notarMudancasCompras() {
  if (!codigoCasa || !sincronizacao || sincronizacaoEmPausa || sincronizacao.precisaJuntar) return;
  let mudou = false;
  const atuais = new Map(dados.compras.map((p) => [p.id, p]));
  atuais.forEach((produto, id) => {
    const valor = valorProduto(produto);
    if (mesmoValor(sincronizacao.espelho[id], valor)) return;
    sincronizacao.espelho[id] = valor;
    sincronizacao.editados[id] = marcaDeTempo();
    delete sincronizacao.apagados[id];
    sincronizacao.pendentes[id] = true;
    mudou = true;
  });
  Object.keys(sincronizacao.espelho).forEach((id) => {
    if (atuais.has(id)) return;
    const antigo = sincronizacao.espelho[id];
    delete sincronizacao.espelho[id];
    const editadoEm = marcaDeTempo();
    sincronizacao.editados[id] = editadoEm;
    sincronizacao.apagados[id] = { nome: antigo.nome, tipo: antigo.tipo, editadoEm };
    sincronizacao.pendentes[id] = true;
    mudou = true;
  });
  if (JSON.stringify(sincronizacao.categorias.espelho) !== JSON.stringify(categoriasCompras)) {
    sincronizacao.categorias = { espelho: [...categoriasCompras], editadoEm: marcaDeTempo(), pendente: true };
    mudou = true;
  }
  if (!mudou) return;
  guardarEstadoSincronizacao();
  agendarEnvio();
  desenharEstadoSincronizacao();
}

// Documento de um produto para a nuvem (nome e tipo cortados aos tamanhos que as regras aceitam); null se não existir.
function documentoProduto(id, atuais) {
  const produto = atuais.get(id);
  const editadoEm = sincronizacao.editados[id];
  if (produto) {
    return { nome: cortar(produto.nome, NOME_MAXIMO_NUVEM, 'Produto'), tipo: cortar(produto.tipo, TIPO_MAXIMO_NUVEM, 'Outros'), comprar: produto.comprar, apagado: false, editadoEm };
  }
  const apagado = sincronizacao.apagados[id];
  if (apagado) {
    return { nome: cortar(apagado.nome, NOME_MAXIMO_NUVEM, 'Produto'), tipo: cortar(apagado.tipo, TIPO_MAXIMO_NUVEM, 'Outros'), comprar: false, apagado: true, editadoEm };
  }
  return null;
}

// No máximo 40 categorias na nuvem, com "Outros" sempre no fim (as restantes ficam só neste aparelho).
function documentoCategorias() {
  const lista = categoriasCompras.length > CATEGORIAS_MAXIMAS_NUVEM
    ? [...categoriasCompras.slice(0, CATEGORIAS_MAXIMAS_NUVEM - 1), 'Outros']
    : [...categoriasCompras];
  return { categorias: lista.map((c) => c.slice(0, TIPO_MAXIMO_NUVEM)), editadoEm: sincronizacao.categorias.editadoEm };
}

// --- Ligação à nuvem ---
let nuvem = null;      // o módulo nuvem.js, depois de carregado
let ligada = false;    // a receber alterações em tempo real
let aLigar = false;
let erroSincronizacao = null;
let ultimosMetadados = { daCache: true };
const emEnvio = {};    // id (ou "__categorias") -> editadoEm já entregue ao Firestore
let temporizadorEnvio = null;
let temporizadorNovaTentativa = null;
const marcasJaLimpas = new Set();

function carregarNuvem() {
  // Nos testes automáticos, uma nuvem simulada pode substituir o Firebase (só se a própria página a definir).
  if (window.__organizadorNuvemDeTeste) return Promise.resolve(window.__organizadorNuvemDeTeste);
  return import(URL_NUVEM);
}

function tentarOutraVez(ms = 30000) {
  clearTimeout(temporizadorNovaTentativa);
  temporizadorNovaTentativa = setTimeout(() => {
    if (!codigoCasa) return;
    if (!ligada) ligarNuvem();
    else agendarEnvio(0);
  }, ms);
}

async function ligarNuvem() {
  if (!codigoCasa || aLigar) return;
  aLigar = true;
  const codigo = codigoCasa;
  try {
    if (!nuvem) nuvem = await carregarNuvem();
    nuvem.desligar();
    ligada = false;
    desenharEstadoSincronizacao();
    await nuvem.sessao();
    if (codigo !== codigoCasa) return;
    if (sincronizacao.precisaJuntar) {
      const remoto = await nuvem.lerCasa(codigo);
      if (codigo !== codigoCasa) return;
      juntarComRemoto(remoto);
    }
    esquecerMarcasAntigas();
    nuvem.ouvir(codigo, {
      aoMudarProdutos: (mudancas, metadados) => { if (codigo === codigoCasa) correrSemFalhar(() => receberProdutos(mudancas, metadados)); },
      aoMudarCategorias: (remotas, metadados) => { if (codigo === codigoCasa) correrSemFalhar(() => receberCategorias(remotas, metadados)); },
      aoErro: (erro) => {
        if (codigo !== codigoCasa) return;
        ligada = false;
        erroSincronizacao = erro;
        desenharEstadoSincronizacao();
        tentarOutraVez();
      },
    });
    ligada = true;
    erroSincronizacao = null;
    agendarEnvio(0);
  } catch (erro) {
    // Sem rede (ex.: a primeira sessão ainda não foi feita): tenta outra vez quando a rede voltar.
    if (navigator.onLine) erroSincronizacao = erro;
    tentarOutraVez();
  } finally {
    aLigar = false;
    desenharEstadoSincronizacao();
  }
}

function agendarEnvio(ms = 300) {
  if (!nuvem || !codigoCasa) return;
  clearTimeout(temporizadorEnvio);
  temporizadorEnvio = setTimeout(() => { enviarPendentes(); }, ms);
}

async function enviarPendentes() {
  if (!nuvem || !codigoCasa || !sincronizacao || sincronizacao.precisaJuntar || !ligada) return;
  const codigo = codigoCasa;
  const atuais = new Map(dados.compras.map((p) => [p.id, p]));
  const produtos = [];
  Object.keys(sincronizacao.pendentes).forEach((id) => {
    if (emEnvio[id] === sincronizacao.editados[id]) return; // já entregue, à espera do servidor
    const documento = documentoProduto(id, atuais);
    if (documento) produtos.push({ id, dados: documento });
    else delete sincronizacao.pendentes[id];
  });
  const categorias = sincronizacao.categorias.pendente && emEnvio.__categorias !== sincronizacao.categorias.editadoEm
    ? documentoCategorias() : null;
  if (produtos.length === 0 && !categorias) return;
  produtos.forEach(({ id, dados: d }) => { emEnvio[id] = d.editadoEm; });
  if (categorias) emEnvio.__categorias = categorias.editadoEm;
  desenharEstadoSincronizacao();
  try {
    await nuvem.enviar(codigo, produtos, categorias);
    if (codigo !== codigoCasa || !sincronizacao) return;
    produtos.forEach(({ id, dados: d }) => {
      if (sincronizacao.editados[id] === d.editadoEm) delete sincronizacao.pendentes[id];
    });
    if (categorias && sincronizacao.categorias.editadoEm === categorias.editadoEm) sincronizacao.categorias.pendente = false;
    erroSincronizacao = null;
    guardarEstadoSincronizacao();
  } catch (erro) {
    erroSincronizacao = erro;
    tentarOutraVez();
  } finally {
    produtos.forEach(({ id, dados: d }) => { if (emEnvio[id] === d.editadoEm) delete emEnvio[id]; });
    if (categorias && emEnvio.__categorias === categorias.editadoEm) delete emEnvio.__categorias;
    desenharEstadoSincronizacao();
  }
}

// --- Receber da nuvem ---
function produtoRemotoValido(r) {
  return r && typeof r.nome === 'string' && r.nome.trim() && typeof r.tipo === 'string' && r.tipo.trim()
    && typeof r.comprar === 'boolean' && typeof r.apagado === 'boolean' && Number.isSafeInteger(r.editadoEm) && r.editadoEm > 0;
}

let temporizadorCompletar = null;

// Grava o que chegou e redesenha a Mercearia (os campos a ser escritos não são redesenhados: ver desenharCompras).
// As categorias usadas pelos produtos que ainda não existam só se juntam um pouco depois, para dar tempo às
// categorias da nuvem de chegarem (ex.: depois de renomear uma no outro aparelho).
function aplicarRemoto() {
  sincronizacaoEmPausa = true;
  try {
    acertarTiposCompras();
    guardarCategoriasCompras();
    guardarDados();
  } finally {
    sincronizacaoEmPausa = false;
  }
  guardarEstadoSincronizacao();
  clearTimeout(temporizadorCompletar);
  temporizadorCompletar = setTimeout(() => {
    if (!codigoCasa) return;
    const completas = completarCategoriasCompras(categoriasCompras);
    if (completas !== categoriasCompras) {
      categoriasCompras = completas;
      acertarTiposCompras();
      guardarCategoriasCompras(); // também põe as categorias na fila
      guardarDados();
      if (vistaAtual === 'mercearia') correrSemFalhar(desenhar.mercearia);
    }
  }, 1500);
  if (vistaAtual === 'mercearia') correrSemFalhar(desenhar.mercearia);
}

function receberProdutos(mudancas, metadados) {
  ultimosMetadados = metadados;
  if (!sincronizacao || sincronizacao.precisaJuntar) return desenharEstadoSincronizacao();
  let aplicou = false;
  let reparar = false;
  const antigas = [];
  const limite = Date.now() - DIAS_MARCAS_APAGADAS * DIA_EM_MS;
  mudancas.forEach(({ id, dados: r }) => {
    if (!produtoRemotoValido(r)) return;
    verMarca(r.editadoEm);
    const local = sincronizacao.editados[id] || 0;
    if (r.editadoEm > local) {
      sincronizacao.editados[id] = r.editadoEm;
      delete sincronizacao.pendentes[id];
      const indice = dados.compras.findIndex((p) => p.id === id);
      if (r.apagado) {
        if (indice !== -1) dados.compras.splice(indice, 1);
        delete sincronizacao.espelho[id];
        sincronizacao.apagados[id] = { nome: r.nome, tipo: r.tipo, editadoEm: r.editadoEm };
      } else {
        const produto = { id, nome: primeiraMaiuscula(r.nome), tipo: r.tipo.trim(), comprar: r.comprar };
        if (indice === -1) dados.compras.push(produto);
        else dados.compras[indice] = produto;
        sincronizacao.espelho[id] = valorProduto(produto);
        delete sincronizacao.apagados[id];
      }
      aplicou = true;
    } else if (r.editadoEm < local && !sincronizacao.pendentes[id]) {
      // A nuvem tem uma versão mais antiga do que a deste aparelho (ex.: uma escrita atrasada): volta a enviar a nossa.
      sincronizacao.pendentes[id] = true;
      reparar = true;
    }
    if (r.apagado && !metadados.daCache && r.atualizadoEm && r.atualizadoEm < limite && !marcasJaLimpas.has(id)) antigas.push(id);
  });
  if (aplicou) aplicarRemoto();
  else if (reparar) guardarEstadoSincronizacao();
  if (reparar) agendarEnvio();
  if (antigas.length > 0) {
    antigas.forEach((id) => marcasJaLimpas.add(id));
    nuvem.apagar(codigoCasa, antigas).catch(() => antigas.forEach((id) => marcasJaLimpas.delete(id)));
  }
  desenharEstadoSincronizacao();
}

function receberCategorias(remotas, metadados) {
  if (!sincronizacao || sincronizacao.precisaJuntar) return;
  if (!remotas) {
    // A casa ainda não tem categorias na nuvem: envia as deste aparelho.
    if (!metadados.daCache && !sincronizacao.categorias.pendente) {
      sincronizacao.categorias.pendente = true;
      guardarEstadoSincronizacao();
      agendarEnvio();
    }
    return;
  }
  if (!Array.isArray(remotas.categorias) || !Number.isSafeInteger(remotas.editadoEm)) return;
  verMarca(remotas.editadoEm);
  if (remotas.editadoEm > sincronizacao.categorias.editadoEm) {
    const lista = normalizarCategoriasCompras(remotas.categorias.filter((c) => typeof c === 'string'));
    sincronizacao.categorias = { espelho: lista, editadoEm: remotas.editadoEm, pendente: false };
    categoriasCompras = [...lista];
    aplicarRemoto();
  } else if (remotas.editadoEm < sincronizacao.categorias.editadoEm && !sincronizacao.categorias.pendente) {
    sincronizacao.categorias.pendente = true;
    guardarEstadoSincronizacao();
    agendarEnvio();
  }
}

// Esquece, neste aparelho, as marcas de apagados com mais de 60 dias.
function esquecerMarcasAntigas() {
  const limite = (Date.now() - DIAS_MARCAS_APAGADAS * DIA_EM_MS) * 1000;
  let mudou = false;
  Object.entries(sincronizacao.apagados).forEach(([id, marca]) => {
    if (marca.editadoEm < limite && !sincronizacao.pendentes[id]) {
      delete sincronizacao.apagados[id];
      delete sincronizacao.editados[id];
      mudou = true;
    }
  });
  if (mudou) guardarEstadoSincronizacao();
}

// --- Juntar a lista deste aparelho com a da nuvem (ao entrar numa casa, depois de importar uma cópia, ou sem estado) ---
// Sem duplicar: compara os nomes como o "Adicionar" (chaveProduto), em qualquer tipo. Num produto repetido fica o da
// nuvem (id, nome e tipo), com "Sim" se algum dos dois estiver a "Sim". Os produtos só deste aparelho entram na nuvem.
// As categorias juntam-se da mesma forma (as da nuvem primeiro). Nada é apagado.
function juntarComRemoto(remoto) {
  const novo = { ...estadoSincronizacaoVazio(), relogio: sincronizacao ? sincronizacao.relogio : 0 };
  const anterior = sincronizacao;
  sincronizacao = novo;
  const locais = dados.compras;
  const porChave = new Map();
  locais.forEach((p) => { if (!porChave.has(chaveProduto(p.nome))) porChave.set(chaveProduto(p.nome), p); });
  const juntados = new Set();
  const lista = [];
  let daNuvem = 0;
  remoto.produtos.forEach(({ id, dados: r }) => {
    if (!produtoRemotoValido(r)) return;
    verMarca(r.editadoEm);
    novo.editados[id] = r.editadoEm;
    if (r.apagado) {
      novo.apagados[id] = { nome: r.nome, tipo: r.tipo, editadoEm: r.editadoEm };
      return;
    }
    daNuvem += 1;
    const produto = { id, nome: primeiraMaiuscula(r.nome), tipo: r.tipo.trim(), comprar: r.comprar };
    novo.espelho[id] = valorProduto(produto);
    const local = porChave.get(chaveProduto(produto.nome));
    if (local && !juntados.has(local)) {
      juntados.add(local);
      produto.comprar = produto.comprar || local.comprar;
    }
    lista.push(produto);
  });
  const usados = new Set(lista.map((p) => p.id));
  let soDeste = 0;
  locais.forEach((p) => {
    if (juntados.has(p)) return;
    soDeste += 1;
    const id = usados.has(p.id) || novo.apagados[p.id] ? novoId() : p.id;
    usados.add(id);
    lista.push({ ...p, id });
  });

  const remotas = remoto.categorias && Array.isArray(remoto.categorias.categorias) && Number.isSafeInteger(remoto.categorias.editadoEm)
    ? normalizarCategoriasCompras(remoto.categorias.categorias.filter((c) => typeof c === 'string'))
    : null;
  if (remotas) {
    verMarca(remoto.categorias.editadoEm);
    novo.categorias = { espelho: remotas, editadoEm: remoto.categorias.editadoEm, pendente: false };
  }
  sincronizacaoEmPausa = true;
  try {
    dados.compras = lista;
    categoriasCompras = completarCategoriasCompras(normalizarCategoriasCompras([...(remotas || []).slice(0, -1), ...categoriasCompras.slice(0, -1)]));
    acertarTiposCompras();
    guardarCategoriasCompras();
    guardarDados();
  } catch (erro) {
    sincronizacao = anterior;
    throw erro;
  } finally {
    sincronizacaoEmPausa = false;
  }
  guardarEstadoSincronizacao();
  notarMudancasCompras(); // o que é só deste aparelho, os "Sim" juntados e as categorias juntas seguem para a nuvem
  if (vistaAtual === 'mercearia') correrSemFalhar(desenhar.mercearia);
  return { total: lista.length, daNuvem, soDeste, juntados: juntados.size };
}

// A lista e as categorias tal como estavam antes da primeira ligação a uma casa (só a primeira vez).
function guardarAntesDaCasa() {
  try {
    if (localStorage.getItem(CHAVE_COMPRAS_ANTES_DA_CASA) === null) {
      localStorage.setItem(CHAVE_COMPRAS_ANTES_DA_CASA, JSON.stringify({
        guardadoEm: new Date().toISOString(), compras: dados.compras, tiposCompras: dados.tiposCompras, categorias: categoriasCompras,
      }));
    }
    return true;
  } catch (erro) {
    return false;
  }
}

// Depois de importar uma cópia de segurança com uma casa ligada: a lista importada junta-se com a da nuvem (nada se
// apaga na nuvem por a cópia não ter um produto).
function pausarSincronizacao() {
  sincronizacaoEmPausa = true;
}

function retomarDepoisDeImportar() {
  sincronizacaoEmPausa = false;
  if (!codigoCasa || !sincronizacao) return;
  sincronizacao.precisaJuntar = true;
  guardarEstadoSincronizacao();
  ligarNuvem();
}

// --- Estado na Mercearia ---
function numeroPorEnviar() {
  if (!sincronizacao) return 0;
  return Object.keys(sincronizacao.pendentes).length + (sincronizacao.categorias.pendente ? 1 : 0) + (sincronizacao.precisaJuntar ? 1 : 0);
}

function textoEstadoSincronizacao() {
  if (!codigoCasa) return null;
  if (!navigator.onLine) return { texto: 'Sem rede: as alterações seguem quando houver internet', erro: false };
  if (erroSincronizacao) {
    const recusado = erroSincronizacao.code === 'permission-denied';
    return {
      texto: recusado
        ? 'A nuvem recusou a lista partilhada. A lista continua guardada neste aparelho.'
        : 'Não foi possível sincronizar agora. A lista continua guardada neste aparelho.',
      erro: true,
    };
  }
  if (!ligada || ultimosMetadados.daCache || numeroPorEnviar() > 0) return { texto: 'A sincronizar…', erro: false };
  return { texto: 'Lista partilhada · sincronizada', erro: false };
}

function desenharEstadoSincronizacao() {
  const linha = document.getElementById('mercearia-sincronizacao');
  if (!linha) return;
  const estado = textoEstadoSincronizacao();
  linha.hidden = !estado;
  linha.textContent = estado ? estado.texto : '';
  linha.classList.toggle('estado-erro', Boolean(estado && estado.erro));
}

window.addEventListener('online', () => {
  if (!codigoCasa) return;
  erroSincronizacao = null;
  if (!ligada) ligarNuvem();
  else agendarEnvio(0);
  desenharEstadoSincronizacao();
});
window.addEventListener('offline', desenharEstadoSincronizacao);

// Ao abrir a app (e sempre que volta a ficar visível): liga à casa, se houver, e envia o que estiver na fila.
aoAbrir.push(() => {
  if (!codigoCasa) return;
  if (!ligada) ligarNuvem();
  else agendarEnvio(0);
  desenharEstadoSincronizacao();
});

// --- Definições: "Lista partilhada da Mercearia" ---
let codigoVisivel = false;
let ocupadoCasa = false;

function mostrarErroCodigo(mensagem) {
  const erro = document.getElementById('casa-codigo-erro');
  const campo = document.getElementById('casa-codigo-entrada');
  erro.textContent = mensagem || '';
  erro.hidden = !mensagem;
  if (mensagem) campo.setAttribute('aria-invalid', 'true');
  else campo.removeAttribute('aria-invalid');
}

function desenharCasa() {
  const ligadaAqui = Boolean(codigoCasa);
  document.getElementById('casa-desligada').hidden = ligadaAqui;
  document.getElementById('casa-ligada').hidden = !ligadaAqui;
  document.querySelectorAll('#casa-desligada button').forEach((b) => { b.disabled = ocupadoCasa; });
  if (!ligadaAqui) return;
  const codigo = document.getElementById('casa-codigo');
  codigo.textContent = codigoVisivel ? codigoCasa : codigoCasa.replace(/[^-]/g, '•');
  codigo.classList.toggle('casa-codigo-escondido', !codigoVisivel);
  const mostrar = document.getElementById('casa-mostrar');
  mostrar.textContent = codigoVisivel ? 'Esconder' : 'Mostrar';
  mostrar.setAttribute('aria-pressed', String(codigoVisivel));
  mostrar.setAttribute('aria-label', codigoVisivel ? 'Esconder o código da casa' : 'Mostrar o código da casa');
}

function guardarCodigoCasa(codigo) {
  localStorage.setItem(CHAVE_CASA, codigo);
  codigoCasa = codigo;
}

async function criarCasa() {
  if (ocupadoCasa || codigoCasa) return;
  if (!guardarAntesDaCasa()) {
    avisar('Não foi possível guardar a lista antes de a partilhar. Nada foi alterado.');
    return;
  }
  try {
    guardarCodigoCasa(gerarCodigoCasa());
  } catch (erro) {
    avisar('Não foi possível guardar o código da casa. Nada foi alterado.');
    return;
  }
  // Tudo o que está neste aparelho segue para a nuvem (o espelho começa vazio).
  sincronizacao = estadoSincronizacaoVazio();
  notarMudancasCompras();
  guardarEstadoSincronizacao();
  codigoVisivel = true;
  desenharCasa();
  desenharEstadoSincronizacao();
  avisar('Casa criada. Passa o código ao outro telemóvel.');
  ligarNuvem();
}

async function entrarNaCasa(texto) {
  if (ocupadoCasa || codigoCasa) return;
  const codigo = normalizarCodigoCasa(texto);
  if (!codigo) {
    mostrarErroCodigo('Este código não é válido. Cola o código completo, tal como aparece no outro telemóvel.');
    return;
  }
  if (!navigator.onLine) {
    mostrarErroCodigo('Para entrar numa casa é preciso internet.');
    return;
  }
  if (!guardarAntesDaCasa()) {
    mostrarErroCodigo('Não foi possível guardar a lista antes de a juntar. Nada foi alterado.');
    return;
  }
  ocupadoCasa = true;
  desenharCasa();
  const botao = document.querySelector('#casa-entrar-formulario button[type="submit"]');
  botao.textContent = 'A entrar…';
  try {
    if (!nuvem) nuvem = await carregarNuvem();
    const remoto = await nuvem.lerCasa(codigo);
    if (!remoto.categorias && remoto.produtos.length === 0) {
      mostrarErroCodigo('Não há nenhuma lista com este código. Confirma o código no outro telemóvel.');
      return;
    }
    guardarCodigoCasa(codigo);
    sincronizacao = estadoSincronizacaoVazio();
    const resultado = juntarComRemoto(remoto);
    document.getElementById('casa-codigo-entrada').value = '';
    mostrarErroCodigo(null);
    codigoVisivel = false;
    avisar(`Entraste na casa. A lista tem agora ${resultado.total} ${resultado.total === 1 ? 'produto' : 'produtos'}.`);
    ligarNuvem();
  } catch (erro) {
    mostrarErroCodigo(erro && erro.code === 'permission-denied'
      ? 'A nuvem recusou este código. Confirma-o no outro telemóvel.'
      : 'Não foi possível entrar na casa agora. Confirma a internet e tenta outra vez. Nada foi alterado.');
  } finally {
    ocupadoCasa = false;
    botao.textContent = 'Entrar numa casa';
    desenharCasa();
    desenharEstadoSincronizacao();
  }
}

function sairDaCasa() {
  if (!codigoCasa) return;
  const porEnviar = numeroPorEnviar() > 0
    ? '\n\nHá alterações que ainda não chegaram à nuvem: ficam só neste aparelho.'
    : '';
  if (!confirm(`Sair da casa? A lista fica neste aparelho como está, mas deixa de ser partilhada.${porEnviar}`)) return;
  if (nuvem) nuvem.desligar();
  clearTimeout(temporizadorEnvio);
  clearTimeout(temporizadorNovaTentativa);
  clearTimeout(temporizadorCompletar);
  ligada = false;
  erroSincronizacao = null;
  codigoCasa = null;
  sincronizacao = null;
  codigoVisivel = false;
  try {
    localStorage.removeItem(CHAVE_CASA);
    localStorage.removeItem(CHAVE_CASA_SINCRONIZACAO);
  } catch (erro) { /* sem acesso: na próxima abertura o código continua lá */ }
  desenharCasa();
  desenharEstadoSincronizacao();
  avisar('Saíste da casa. A lista continua neste aparelho.');
}

async function copiarCodigoCasa() {
  if (!codigoCasa) return;
  try {
    await navigator.clipboard.writeText(codigoCasa);
    avisar('Código copiado.');
    return;
  } catch (erro) { /* sem acesso à área de transferência: tenta da forma antiga */ }
  const caixa = criar('textarea', { value: codigoCasa, readOnly: true, className: 'copiar-escondido' });
  document.body.append(caixa);
  caixa.select();
  let copiou = false;
  try {
    copiou = document.execCommand('copy');
  } catch (erro) { /* não deu */ }
  caixa.remove();
  if (copiou) avisar('Código copiado.');
  else {
    codigoVisivel = true;
    desenharCasa();
    avisar('Não deu para copiar: o código está à vista, copia-o à mão.');
  }
}

document.getElementById('casa-criar').addEventListener('click', criarCasa);
document.getElementById('casa-entrar-formulario').addEventListener('submit', (evento) => {
  evento.preventDefault();
  entrarNaCasa(document.getElementById('casa-codigo-entrada').value);
});
document.getElementById('casa-codigo-entrada').addEventListener('input', () => mostrarErroCodigo(null));
document.getElementById('casa-mostrar').addEventListener('click', () => { codigoVisivel = !codigoVisivel; desenharCasa(); });
document.getElementById('casa-copiar').addEventListener('click', copiarCodigoCasa);
document.getElementById('casa-sair').addEventListener('click', sairDaCasa);
