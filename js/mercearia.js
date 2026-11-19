// mercearia.js: vista Mercearia (a primeira da barra; a app abre sempre nela). De cima para baixo: o lembrete da cópia
// de segurança (com "Exportar dados" dentro), a lista de produtos (compras.js, lista-semanal.js e importar.js), que se
// pode recolher, e o "Registar compras" (gastos.js). Os registos de compras aparecem e contam na vista Gastos.

// --- Lembrete da cópia: só quando nunca houve cópia ou passaram mais de 30 dias ---
// É só um atalho: "Exportar dados" e "Importar dados" estão sempre nas Definições.
function desenharLembreteCopia() {
  const texto = textoLembreteCopia();
  document.getElementById('mercearia-lembrete').hidden = !texto;
  document.getElementById('mercearia-lembrete-texto').textContent = texto || '';
}

document.getElementById('mercearia-exportar').addEventListener('click', () => exportarCopia());

// --- Recolher e mostrar a lista de produtos ---
// A escolha fica numa chave própria e vai na cópia de segurança, em "preferencias".
const CHAVE_PRODUTOS_RECOLHIDOS = 'organizador-produtos-recolhidos';

function lerProdutosRecolhidos() {
  try {
    return localStorage.getItem(CHAVE_PRODUTOS_RECOLHIDOS) === 'sim';
  } catch (erro) {
    return false;
  }
}

function aplicarProdutosRecolhidos(recolhidos) {
  const botao = document.getElementById('produtos-alternar');
  document.getElementById('produtos-corpo').hidden = recolhidos;
  botao.setAttribute('aria-expanded', String(!recolhidos));
  botao.setAttribute('aria-label', recolhidos ? 'Mostrar produtos' : 'Esconder produtos');
  botao.querySelector('.produtos-seta').textContent = recolhidos ? '▸' : '▾';
  // Com a lista recolhida, não há nada para editar: o Editar só volta com a lista aberta.
  document.getElementById('compras-editar').hidden = recolhidos;
  desenharContadorCompras();
}

document.getElementById('produtos-alternar').addEventListener('click', () => {
  const recolhidos = !document.getElementById('produtos-corpo').hidden;
  try {
    localStorage.setItem(CHAVE_PRODUTOS_RECOLHIDOS, recolhidos ? 'sim' : 'nao');
  } catch (erro) { /* sem armazenamento: a escolha vale só até recarregar */ }
  aplicarProdutosRecolhidos(recolhidos);
});

aplicarProdutosRecolhidos(lerProdutosRecolhidos());

desenhar.mercearia = () => {
  correrSemFalhar(desenharLembreteCopia);
  correrSemFalhar(desenharCompras);
};
