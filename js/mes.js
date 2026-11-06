// mes.js: separador Despesas mensais. Seletor de mês, lembrete da cópia de segurança e a secção "Gastos" (ver despesas.js).
// Os hábitos (exercício, jejum, água, tabaco e álcool) já não aparecem aqui: continuam guardados e na vista Semana.

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

function desenharLembreteCopia() {
  const texto = textoLembreteCopia();
  const lembrete = document.getElementById('mes-lembrete');
  lembrete.hidden = !texto;
  if (texto) document.getElementById('mes-lembrete-texto').textContent = texto;
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
document.getElementById('mes-exportar').addEventListener('click', exportarCopia);

desenhar.mes = desenharMes;
