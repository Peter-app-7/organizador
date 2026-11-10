// app.js: arranca a app e trata da navegação entre as vistas.

let vistaAtual = 'semana';

function mostrarVista(nome) {
  vistaAtual = nome;
  document.querySelectorAll('.vista').forEach((seccao) => {
    seccao.hidden = seccao.id !== `vista-${nome}`;
  });
  document.querySelectorAll('.navegacao button').forEach((botao) => {
    if (botao.dataset.vista === nome) botao.setAttribute('aria-current', 'page');
    else botao.removeAttribute('aria-current');
  });
  if (desenhar[nome]) correrSemFalhar(desenhar[nome]);
  window.scrollTo(0, 0);
}

document.querySelectorAll('.navegacao button').forEach((botao) => {
  botao.addEventListener('click', () => mostrarVista(botao.dataset.vista));
});
document.getElementById('botao-ajustes').addEventListener('click', () => mostrarVista('ajustes'));

// Quando a app volta a ficar visível (pode já ser outro dia), atualiza o que estiver no ecrã.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  aoAbrir.forEach(correrSemFalhar);
  if (desenhar[vistaAtual]) correrSemFalhar(desenhar[vistaAtual]);
});

// Se a app ficar aberta durante a meia-noite, atualiza o ecrã (ex.: limpa os suplementos tomados).
let diaMostrado = dataParaTexto(new Date());
function verificarMudancaDeDia() {
  const hoje = dataParaTexto(new Date());
  if (hoje === diaMostrado) return;
  diaMostrado = hoje;
  aoAbrir.forEach(correrSemFalhar);
  if (desenhar[vistaAtual]) correrSemFalhar(desenhar[vistaAtual]);
}
setInterval(verificarMudancaDeDia, 60 * 1000);

// Pede ao sistema para não apagar os dados sozinho, se precisar de espaço. Sem suporte, não faz nada.
try {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
} catch (erro) { /* sem suporte: os dados continuam no localStorage */ }

// Permite abrir a app sem internet. Só funciona em https ou em localhost.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

aoAbrir.forEach(correrSemFalhar);
mostrarVista('semana');
if (avisoMigracao) avisar(avisoMigracao);
