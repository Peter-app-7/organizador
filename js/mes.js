// mes.js: vista Gastos. Junta a lista de produtos (compras.js) e as Despesas mensais (seletor de mês e despesas.js),
// com o botão "Exportar dados" sempre visível e o lembrete da cópia de segurança.
// Os hábitos (exercício, jejum, água, tabaco e álcool) não aparecem aqui: continuam guardados e na vista Semana.

// Mês mostrado, a contar do atual: 0 é este, -1 o anterior, 1 o seguinte.
let mesDeslocamento = 0;

const NOMES_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function inicioDoMes(deslocamento) {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth() + deslocamento, 1);
}

// Ex.: "2026-11".
function chaveMes(data) {
  return dataParaTexto(data).slice(0, 7);
}

// O lembrete só aparece com a cópia em falta; o botão "Exportar dados" está sempre visível, ao lado do título.
function desenharLembreteCopia() {
  const texto = textoLembreteCopia();
  const lembrete = document.getElementById('mes-lembrete');
  lembrete.hidden = !texto;
  lembrete.textContent = texto || '';
}

function desenharMes() {
  const mes = inicioDoMes(mesDeslocamento);
  document.getElementById('mes-titulo').textContent = `${NOMES_MESES[mes.getMonth()]} de ${mes.getFullYear()}`;
  document.getElementById('mes-hoje').hidden = mesDeslocamento === 0;
  desenharLembreteCopia();
  // Com um gasto a ser editado, não se mexe nele (ex.: a app voltou a ficar visível).
  const caixaGastos = document.getElementById('mes-gastos');
  if (!(caixaGastos.contains(document.activeElement) && caixaGastos.dataset.mes === chaveMes(mes))) desenharDespesasMes(mes);
  const caixaCategorias = document.getElementById('despesas-categorias-caixa');
  if (caixaCategorias.open && !caixaCategorias.contains(document.activeElement)) desenharCategoriasDespesas();
}

function mudarMes(deslocamento) {
  mesDeslocamento = deslocamento;
  despesaAEditar = null;
  desenharMes();
}

document.getElementById('mes-anterior').addEventListener('click', () => mudarMes(mesDeslocamento - 1));
document.getElementById('mes-seguinte').addEventListener('click', () => mudarMes(mesDeslocamento + 1));
document.getElementById('mes-hoje').addEventListener('click', () => mudarMes(0));
document.getElementById('gastos-exportar').addEventListener('click', exportarCopia);

// --- Recolher e mostrar a lista de produtos ---
// A escolha fica só neste aparelho, numa chave própria (não entra na cópia de segurança).
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

desenhar.gastos = () => {
  correrSemFalhar(desenharCompras);
  correrSemFalhar(desenharMes);
};
