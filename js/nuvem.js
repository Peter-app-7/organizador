// nuvem.js (módulo): ligação ao Firebase (autenticação anónima e Firestore), só para a lista partilhada da Mercearia.
// Só é carregado por casa.js quando este aparelho está ligado a uma casa: sem casa, a app não faz nenhum pedido à
// internet. O SDK do Firebase (versão 10.14.1) está guardado em js/vendor/firebase/, para funcionar sem internet e
// não mudar sozinho. Este ficheiro só lê e escreve: as decisões (juntar listas, ganhar a última alteração) são de casa.js.
//
// No Firestore: casas/{codigo}/produtos/{idProduto} = { nome, tipo, comprar, apagado, editadoEm, atualizadoEm }
//               casas/{codigo}/config/categorias   = { categorias: [...], editadoEm, atualizadoEm }
// Regras de segurança em firestore.rules (coladas à mão na consola do Firebase).

import { initializeApp } from './vendor/firebase/firebase-app.js';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, signInAnonymously,
} from './vendor/firebase/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  collection, doc, onSnapshot, writeBatch, serverTimestamp, getDocsFromServer, getDocFromServer,
} from './vendor/firebase/firebase-firestore.js';

// Esta configuração não é secreta: identifica o projeto. O que protege os dados são as regras e o código da casa.
const firebaseConfig = {
  apiKey: 'AIzaSyAF4yfYAIo-vFTm7bjWIIv5lKl9WDtAmDQ',
  authDomain: 'organizador-mercearia.firebaseapp.com',
  projectId: 'organizador-mercearia',
  storageBucket: 'organizador-mercearia.firebasestorage.app',
  messagingSenderId: '1072412583074',
  appId: '1:1072412583074:web:c72b33fc06c4d8cad2a3fb',
};

const ESCRITAS_POR_LOTE = 450; // o Firestore aceita até 500 por lote

let app = null;
let auth = null;
let db = null;
let pararDeOuvir = [];

function iniciar() {
  if (app) return;
  app = initializeApp(firebaseConfig);
  // Sem o "popupRedirectResolver" do getAuth(), para não carregar nada de outros sites.
  auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  // Cache persistente (IndexedDB): as alterações feitas sem rede ficam guardadas também aqui.
  // Se não der (ex.: navegação privada), fica a cache em memória; casa.js tem sempre a sua fila no localStorage.
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch (erro) {
    db = initializeFirestore(app, { localCache: memoryLocalCache() });
  }
}

// Sessão anónima: a primeira vez precisa de internet; depois fica guardada no aparelho.
export async function sessao() {
  iniciar();
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);
  return auth.currentUser;
}

export function temSessao() {
  return Boolean(auth && auth.currentUser);
}

// A hora do servidor passa a milissegundos (ou null, enquanto não chega).
function converter(dados) {
  const hora = dados.atualizadoEm;
  return { ...dados, atualizadoEm: hora && typeof hora.toMillis === 'function' ? hora.toMillis() : null };
}

// Lê a casa diretamente do servidor (para "Entrar numa casa"): falha sem rede.
export async function lerCasa(codigo) {
  await sessao();
  const [produtos, categorias] = await Promise.all([
    getDocsFromServer(collection(db, 'casas', codigo, 'produtos')),
    getDocFromServer(doc(db, 'casas', codigo, 'config', 'categorias')),
  ]);
  return {
    produtos: produtos.docs.map((d) => ({ id: d.id, dados: converter(d.data()) })),
    categorias: categorias.exists() ? converter(categorias.data()) : null,
  };
}

// Recebe as alterações em tempo real. "aoMudar" recebe { produtos: [{ id, dados }], categorias, daCache, porEnviar }.
export function ouvir(codigo, { aoMudarProdutos, aoMudarCategorias, aoErro }) {
  desligar();
  const opcoes = { includeMetadataChanges: true };
  pararDeOuvir.push(onSnapshot(collection(db, 'casas', codigo, 'produtos'), opcoes, (instantaneo) => {
    const mudancas = instantaneo.docChanges()
      .filter((m) => m.type !== 'removed')
      .map((m) => ({ id: m.doc.id, dados: converter(m.doc.data({ serverTimestamps: 'estimate' })) }));
    aoMudarProdutos(mudancas, { daCache: instantaneo.metadata.fromCache, porEnviar: instantaneo.metadata.hasPendingWrites });
  }, aoErro));
  pararDeOuvir.push(onSnapshot(doc(db, 'casas', codigo, 'config', 'categorias'), opcoes, (instantaneo) => {
    aoMudarCategorias(instantaneo.exists() ? converter(instantaneo.data({ serverTimestamps: 'estimate' })) : null,
      { daCache: instantaneo.metadata.fromCache, porEnviar: instantaneo.metadata.hasPendingWrites });
  }, aoErro));
}

export function desligar() {
  pararDeOuvir.forEach((parar) => parar());
  pararDeOuvir = [];
}

// Grava produtos [{ id, dados }] e, se vierem, as categorias, em lotes. A promessa só se cumpre quando o servidor
// confirma (sem rede, fica à espera; o Firestore envia quando a rede voltar).
export async function enviar(codigo, produtos, categorias) {
  await sessao();
  const escritas = produtos.map(({ id, dados }) => [doc(db, 'casas', codigo, 'produtos', id), dados]);
  if (categorias) escritas.push([doc(db, 'casas', codigo, 'config', 'categorias'), categorias]);
  const lotes = [];
  for (let i = 0; i < escritas.length; i += ESCRITAS_POR_LOTE) {
    const lote = writeBatch(db);
    escritas.slice(i, i + ESCRITAS_POR_LOTE).forEach(([ref, dados]) => lote.set(ref, { ...dados, atualizadoEm: serverTimestamp() }));
    lotes.push(lote.commit());
  }
  await Promise.all(lotes);
}

// Apaga de vez as marcas de produtos apagados (ids), em lotes.
export async function apagar(codigo, ids) {
  await sessao();
  const lotes = [];
  for (let i = 0; i < ids.length; i += ESCRITAS_POR_LOTE) {
    const lote = writeBatch(db);
    ids.slice(i, i + ESCRITAS_POR_LOTE).forEach((id) => lote.delete(doc(db, 'casas', codigo, 'produtos', id)));
    lotes.push(lote.commit());
  }
  await Promise.all(lotes);
}
