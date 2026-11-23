// mes.js: vista Gastos. De cima para baixo (desde 23 nov 2026): título e, na mesma linha, três botões só com ícone,
// "Importar do cartão" (despesas.js), "Exportar" e "Importar" (CSV, exportar-csv.js e importar-csv.js), com as mensagens por baixo;
// traço; seletor do período; seletor "Meus · <pessoa> · Juntos" (só com gastos importados); traço; bloco "Gastos do
// mês", com os gastos por confirmar, "Por categorizar" e os blocos Casa e Pessoal, agrupados por categoria (despesas.js);
// no fim, depois de um traço, "Gastos fixos" (fixos.js) e "Categorias de gastos" (dia de início, categorias e
// comerciantes lembrados), recolhidas por defeito; e a barra fixa com o total do período. A lista de produtos está na
// vista Mercearia (mercearia.js).
//
// Os gastos agrupam-se por "mês de gastos" (período), não por mês de calendário: começa no dia dados.diaInicioGastos
// (21 por defeito, o dia em que entra o ordenado) e acaba na véspera desse dia no mês seguinte. O período tem o nome do
// mês em que acaba: com início a 21, de 21 nov a 20 dez é "Dezembro". Com o dia 1, é o mês de calendário.
// Com a opção "dia útil" (dados.diaInicioDiaUtil), se esse dia calhar a um sábado, domingo ou feriado nacional, o
// período começa no dia útil anterior (ex.: 21 nov 2026 é sábado, por isso "Dezembro de 2026" vai de 20 nov a 20 dez).
// As datas guardadas nunca mudam: cada registo pertence ao período que a sua data indica.

// Período mostrado, a contar do de hoje: 0 é o que contém hoje, -1 o anterior, 1 o seguinte.
let mesDeslocamento = 0;

const NOMES_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function diaInicioGastos() {
  return dados.diaInicioGastos;
}

// --- Dia útil: nem sábado, nem domingo, nem feriado nacional de Portugal (sem feriados municipais; sem pedidos à
// internet). Com dados.diaInicioDiaUtil, cada período começa no dia útil anterior quando o dia de início não é útil
// (o ordenado entra nesse dia). ---

// Domingo de Páscoa (calendário gregoriano, algoritmo de Meeus/Butcher), como Date local.
function domingoDePascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

// Feriados nacionais fixos, "MM-DD": Ano Novo, 25 de Abril, 1.º de Maio, 10 de Junho, Assunção, Implantação da
// República, Todos os Santos, Restauração da Independência, Imaculada Conceição e Natal. O Carnaval não é feriado.
const FERIADOS_FIXOS = ['01-01', '04-25', '05-01', '06-10', '08-15', '10-05', '11-01', '12-01', '12-08', '12-25'];
const feriadosMoveis = {}; // por ano: ["AAAA-MM-DD" da Sexta-feira Santa, do Corpo de Deus]

// data: Date local. Sexta-feira Santa = Páscoa - 2 dias; Corpo de Deus = Páscoa + 60 dias.
function eFeriadoNacional(data) {
  const texto = dataParaTexto(data);
  if (FERIADOS_FIXOS.includes(texto.slice(5))) return true;
  const ano = data.getFullYear();
  if (!feriadosMoveis[ano]) {
    const pascoa = domingoDePascoa(ano);
    feriadosMoveis[ano] = [-2, 60].map((dias) =>
      dataParaTexto(new Date(pascoa.getFullYear(), pascoa.getMonth(), pascoa.getDate() + dias)));
  }
  return feriadosMoveis[ano].includes(texto);
}

function eDiaUtil(data) {
  const semana = data.getDay();
  return semana !== 0 && semana !== 6 && !eFeriadoNacional(data);
}

// O próprio dia, se for útil; senão, o dia útil anterior (pode ser noutro mês ou ano).
function diaUtilAteA(data) {
  const dia = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  while (!eDiaUtil(dia)) dia.setDate(dia.getDate() - 1);
  return dia;
}

// Início do período cujo último mês é "ano"/"mes", sem a opção do dia útil: com o dia 1, o dia 1 do próprio mês;
// senão, esse dia no mês anterior.
function inicioNominalDoPeriodo(ano, mes) {
  const dia = diaInicioGastos();
  return new Date(ano, dia === 1 ? mes : mes - 1, dia);
}

// Início verdadeiro: o nominal ou, com a opção ligada, o dia útil até ele.
function inicioDoPeriodo(ano, mes) {
  const inicio = inicioNominalDoPeriodo(ano, mes);
  return dados.diaInicioDiaUtil ? diaUtilAteA(inicio) : inicio;
}

// Período cujo último mês é "ano"/"mes" (mes de 0 a 11; aceita valores fora, ex.: 12 é janeiro do ano seguinte).
// Devolve { ano, mes, inicio, fim, chave }: inicio e fim em "AAAA-MM-DD" (os dois incluídos); chave "AAAA-MM" do mês
// que dá o nome (o do fim, sem a opção do dia útil). Acaba na véspera do início do período seguinte: sem a opção, a
// véspera do mesmo dia, um mês depois; com ela, os dois inícios podem recuar e os períodos têm comprimentos diferentes,
// mas nunca se sobrepõem nem deixam dias de fora. O nome é sempre o que teria sem a opção.
function periodoQueAcabaEm(ano, mes) {
  const nome = new Date(ano, mes, 1);
  const inicio = inicioDoPeriodo(ano, mes);
  const seguinte = inicioDoPeriodo(ano, mes + 1);
  const fim = new Date(seguinte.getFullYear(), seguinte.getMonth(), seguinte.getDate() - 1);
  return {
    ano: nome.getFullYear(),
    mes: nome.getMonth(),
    inicio: dataParaTexto(inicio),
    fim: dataParaTexto(fim),
    chave: dataParaTexto(nome).slice(0, 7),
  };
}

// Período a que pertence uma data "AAAA-MM-DD": dia >= dia de início, o que acaba no mês seguinte;
// senão, o que acaba nesse mesmo mês. Ex. (início 21): 20 nov -> Novembro; 21 nov -> Dezembro; 31 dez -> Janeiro.
// Com a opção do dia útil, o seguinte pode começar mais cedo (ex.: a 20 nov, se 21 nov for sábado): a data passa
// para ele se já lá chegou. O início só recua, e nunca um período inteiro, por isso não é preciso ver mais nenhum.
function periodoDaData(texto) {
  const [ano, mes, dia] = texto.split('-').map(Number);
  const dia1 = diaInicioGastos();
  const periodo = periodoQueAcabaEm(ano, (mes - 1) + (dia1 > 1 && dia >= dia1 ? 1 : 0));
  if (dados.diaInicioDiaUtil && texto > periodo.fim) return periodoQueAcabaEm(periodo.ano, periodo.mes + 1);
  return periodo;
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

function desenharMes() {
  const periodo = periodoDoDeslocamento(mesDeslocamento);
  document.getElementById('mes-titulo').textContent = `${NOMES_MESES[periodo.mes]} de ${periodo.ano}`;
  document.getElementById('mes-intervalo').textContent = intervaloDoPeriodo(periodo);
  document.getElementById('mes-hoje').hidden = mesDeslocamento === 0;
  desenharDiaInicio();
  // "Gastos fixos" (fixos.js): o resumo e, aberta, a lista.
  if (typeof desenharFixos === 'function') correrSemFalhar(desenharFixos);
  // Com um gasto a ser editado, não se mexe nele (ex.: a app voltou a ficar visível). Só conta o formulário da edição:
  // o foco noutro botão da lista (ex.: a linha de uma categoria) não impede de a desenhar outra vez.
  const caixaGastos = document.getElementById('mes-gastos');
  const edicao = caixaGastos.querySelector('.gasto-editar');
  const aEditar = Boolean(despesaAEditar && edicao && edicao.contains(document.activeElement));
  if (!(aEditar && caixaGastos.dataset.mes === periodo.chave)) desenharDespesasMes(periodo);
  // Os comerciantes lembrados (abertos) acompanham os nomes das categorias, se ninguém estiver a escrever lá dentro.
  const caixaComerciantes = document.getElementById('despesas-comerciantes');
  if (!caixaComerciantes.hidden && !caixaComerciantes.contains(document.activeElement)) desenharComerciantes();
}

function mudarMes(deslocamento) {
  mesDeslocamento = deslocamento;
  despesaAEditar = null;
  desenharMes();
}

document.getElementById('mes-anterior').addEventListener('click', () => mudarMes(mesDeslocamento - 1));
document.getElementById('mes-seguinte').addEventListener('click', () => mudarMes(mesDeslocamento + 1));
document.getElementById('mes-hoje').addEventListener('click', () => mudarMes(0));

// Ao entrar na vista Gastos, mostra o período que contém hoje ou, logo depois de "Registar compras" na Mercearia,
// o período dessa compra.
let deslocamentoAoEntrar = null;
aoEntrar.gastos = () => {
  mesDeslocamento = deslocamentoAoEntrar === null ? 0 : deslocamentoAoEntrar;
  deslocamentoAoEntrar = null;
  despesaAEditar = null;
};

// --- "Dia em que começa o mês de gastos", em "Categorias de gastos" ---
const campoDiaInicio = document.getElementById('despesas-dia-inicio');
const erroDiaInicio = document.getElementById('despesas-dia-inicio-erro');
// Interruptor "Se calhar ao fim de semana ou feriado, começa no dia útil anterior" (dados.diaInicioDiaUtil).
const campoDiaUtil = document.getElementById('despesas-dia-util');

function mostrarErroDiaInicio(mensagem) {
  erroDiaInicio.textContent = mensagem || '';
  erroDiaInicio.hidden = !mensagem;
  if (mensagem) campoDiaInicio.setAttribute('aria-invalid', 'true');
  else campoDiaInicio.removeAttribute('aria-invalid');
}

function desenharDiaInicio() {
  if (document.activeElement !== campoDiaInicio) campoDiaInicio.value = diaInicioGastos();
  campoDiaUtil.checked = dados.diaInicioDiaUtil;
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

campoDiaUtil.addEventListener('change', () => {
  dados.diaInicioDiaUtil = campoDiaUtil.checked;
  guardarDados();
  // Como mudar o dia: os gastos são os mesmos, só se agrupam de outra forma. Volta ao período de hoje.
  mesDeslocamento = 0;
  despesaAEditar = null;
  desenharMes();
  avisar(campoDiaUtil.checked
    ? 'Se o dia de início calhar ao fim de semana ou feriado, o mês de gastos começa no dia útil anterior.'
    : `O mês de gastos começa sempre no dia ${diaInicioGastos()}.`);
});

desenhar.gastos = desenharMes;
