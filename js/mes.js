// mes.js: vista Gastos. De cima para baixo: título com "Importar do cartão", seletor do período, bloco Mercearia
// (com "Exportar dados", o lembrete da cópia e a lista de produtos de compras.js), bloco "Gastos do mês" (despesas.js)
// e a barra fixa com o total do período.
// O exercício e o jejum não aparecem aqui: estão nas vistas Semana e Suplementos.
//
// Os gastos agrupam-se por "mês de gastos" (período), não por mês de calendário: começa no dia dados.diaInicioGastos
// (21 por defeito, o dia em que entra o ordenado) e acaba na véspera desse dia no mês seguinte. O período tem o nome do
// mês em que acaba: com início a 21, de 21 nov a 20 dez é "Dezembro". Com o dia 1, é o mês de calendário.
// As datas guardadas nunca mudam: cada registo pertence ao período que a sua data indica.

// Período mostrado, a contar do de hoje: 0 é o que contém hoje, -1 o anterior, 1 o seguinte.
let mesDeslocamento = 0;

const NOMES_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function diaInicioGastos() {
  return dados.diaInicioGastos;
}

// Período cujo último mês é "ano"/"mes" (mes de 0 a 11; aceita valores fora, ex.: 12 é janeiro do ano seguinte).
// Devolve { ano, mes, inicio, fim, chave }: inicio e fim em "AAAA-MM-DD" (os dois incluídos); chave "AAAA-MM" do mês do fim.
function periodoQueAcabaEm(ano, mes) {
  const dia = diaInicioGastos();
  // Com o dia 1, começa no próprio mês; senão, no mês anterior. Acaba na véspera do mesmo dia, um mês depois.
  const inicio = new Date(ano, dia === 1 ? mes : mes - 1, dia);
  const fim = new Date(inicio.getFullYear(), inicio.getMonth() + 1, dia - 1);
  return {
    ano: fim.getFullYear(),
    mes: fim.getMonth(),
    inicio: dataParaTexto(inicio),
    fim: dataParaTexto(fim),
    chave: dataParaTexto(fim).slice(0, 7),
  };
}

// Período a que pertence uma data "AAAA-MM-DD": dia >= dia de início, o que acaba no mês seguinte;
// senão, o que acaba nesse mesmo mês. Ex. (início 21): 20 nov -> Novembro; 21 nov -> Dezembro; 31 dez -> Janeiro.
function periodoDaData(texto) {
  const [ano, mes, dia] = texto.split('-').map(Number);
  const dia1 = diaInicioGastos();
  return periodoQueAcabaEm(ano, (mes - 1) + (dia1 > 1 && dia >= dia1 ? 1 : 0));
}

// Período a "deslocamento" períodos do de hoje.
function periodoDoDeslocamento(deslocamento) {
  const hoje = periodoDaData(dataParaTexto(new Date()));
  return periodoQueAcabaEm(hoje.ano, hoje.mes + deslocamento);
}

// Deslocamento do período de uma data, a contar do de hoje (para levar o seletor até um registo).
function deslocamentoDaData(texto) {
  const periodo = periodoDaData(texto);
  const hoje = periodoDaData(dataParaTexto(new Date()));
  return (periodo.ano - hoje.ano) * 12 + (periodo.mes - hoje.mes);
}

// Ex.: "21 nov a 20 dez".
function intervaloDoPeriodo(periodo) {
  return `${dataAbreviada(periodo.inicio)} a ${dataAbreviada(periodo.fim)}`;
}

// O lembrete só aparece com a cópia em falta; o botão "Exportar dados" está sempre visível, ao lado de "Mercearia".
function desenharLembreteCopia() {
  const texto = textoLembreteCopia();
  const lembrete = document.getElementById('mes-lembrete');
  lembrete.hidden = !texto;
  lembrete.textContent = texto || '';
}

function desenharMes() {
  const periodo = periodoDoDeslocamento(mesDeslocamento);
  document.getElementById('mes-titulo').textContent = `${NOMES_MESES[periodo.mes]} de ${periodo.ano}`;
  document.getElementById('mes-intervalo').textContent = intervaloDoPeriodo(periodo);
  document.getElementById('mes-hoje').hidden = mesDeslocamento === 0;
  desenharDiaInicio();
  desenharLembreteCopia();
  // Com um gasto a ser editado, não se mexe nele (ex.: a app voltou a ficar visível).
  const caixaGastos = document.getElementById('mes-gastos');
  if (!(caixaGastos.contains(document.activeElement) && caixaGastos.dataset.mes === periodo.chave)) desenharDespesasMes(periodo);
  const caixaCategorias = document.getElementById('despesas-categorias-caixa');
  if (caixaCategorias.open && !caixaCategorias.contains(document.activeElement)) {
    desenharCategoriasDespesas();
    desenharComerciantes();
  }
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

// Ao entrar na vista Gastos, mostra o período que contém hoje.
aoEntrar.gastos = () => {
  mesDeslocamento = 0;
  despesaAEditar = null;
};

// --- "Dia em que começa o mês de gastos", em "Categorias de gastos" ---
const campoDiaInicio = document.getElementById('despesas-dia-inicio');
const erroDiaInicio = document.getElementById('despesas-dia-inicio-erro');

function mostrarErroDiaInicio(mensagem) {
  erroDiaInicio.textContent = mensagem || '';
  erroDiaInicio.hidden = !mensagem;
  if (mensagem) campoDiaInicio.setAttribute('aria-invalid', 'true');
  else campoDiaInicio.removeAttribute('aria-invalid');
}

function desenharDiaInicio() {
  if (document.activeElement !== campoDiaInicio) campoDiaInicio.value = diaInicioGastos();
  document.getElementById('despesas-dia-inicio-nota').textContent = diaInicioGastos() === 1
    ? 'Dia 1: os gastos agrupam-se por mês de calendário.'
    : 'As datas dos gastos não mudam.';
}

campoDiaInicio.addEventListener('input', () => mostrarErroDiaInicio(null));
campoDiaInicio.addEventListener('change', () => {
  const valor = Number(campoDiaInicio.value);
  if (!Number.isInteger(valor) || valor < 1 || valor > 28) {
    mostrarErroDiaInicio('Escolhe um dia de 1 a 28.');
    return;
  }
  mostrarErroDiaInicio(null);
  if (valor === dados.diaInicioGastos) return;
  dados.diaInicioGastos = valor;
  guardarDados();
  // Os gastos são os mesmos: só se agrupam de outra forma. Volta ao período de hoje.
  mesDeslocamento = 0;
  despesaAEditar = null;
  desenharMes();
  avisar(valor === 1 ? 'Os gastos agrupam-se agora por mês de calendário.' : `O mês de gastos começa agora no dia ${valor}.`);
});

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
