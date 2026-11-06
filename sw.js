// sw.js: "service worker". Guarda os ficheiros da app no aparelho, para abrir sem internet.
// Tenta sempre primeiro a versão mais recente; sem internet, usa a guardada.
// Pergunta sempre ao servidor, sem usar a cache do navegador: o GitHub Pages deixa guardar os ficheiros
// durante 10 minutos, e misturar ficheiros de versões diferentes pode partir a app.
// A previsão do tempo vem de outro endereço, por isso não passa por aqui.

const NOME_CACHE = 'organizador-v22';
const FICHEIROS = [
  './',
  'index.html',
  'style.css',
  'manifest.json',
  'icon.png',
  'js/dados.js',
  'js/tempo.js',
  'js/suplementos.js',
  'js/semana.js',
  'js/habitos.js',
  'js/jejum.js',
  'js/compras.js',
  'js/lista-semanal.js',
  'js/importar.js',
  'js/receitas-dados.js',
  'js/receitas.js',
  'js/localidade.js',
  'js/ajustes.js',
  'js/gastos.js',
  'js/mes.js',
  'js/app.js',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(NOME_CACHE).then((cache) => cache.addAll(FICHEIROS.map((ficheiro) => new Request(ficheiro, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  // Apaga versões antigas dos ficheiros guardados.
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((nome) => nome !== NOME_CACHE).map((nome) => caches.delete(nome)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (evento) => {
  const endereco = new URL(evento.request.url);
  if (evento.request.method !== 'GET' || endereco.origin !== self.location.origin) return;

  evento.respondWith((async () => {
    const cache = await caches.open(NOME_CACHE);
    try {
      const resposta = await fetch(evento.request, { cache: 'no-cache' });
      if (resposta.ok) await cache.put(evento.request, resposta.clone());
      return resposta;
    } catch (erro) {
      const guardada = await cache.match(evento.request);
      if (guardada) return guardada;
      if (evento.request.mode === 'navigate') return cache.match('index.html');
      throw erro;
    }
  })());
});
