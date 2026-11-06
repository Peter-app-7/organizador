// mes.js: vista Mês. Revisão de um mês com os dados que a app já regista, comparação com o mês anterior
// e notas do mês. Os suplementos tomados e as receitas não entram: a app só guarda os de hoje e os desta semana.

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

function diasNoMes(data) {
  return new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
}

// Ex.: 1.25 passa a "1,3".
function numeroCurto(valor) {
  return valor.toLocaleString('pt-PT', { maximumFractionDigits: 1 });
}

// Conta o que está registado em dias desse mês. Só lê os dados, nunca os muda.
function resumoDoMes(data) {
  const prefixo = `${chaveMes(data)}-`;
  const noMes = (lista) => lista.filter((dia) => dia.startsWith(prefixo)).length;
  const litros = Object.entries(dados.agua).filter(([dia]) => dia.startsWith(prefixo)).map(([, valor]) => valor);
  const comprados = Object.entries(dados.comprasFeitas)
    .filter(([dia]) => dia.startsWith(prefixo))
    .reduce((soma, [, numero]) => soma + numero, 0);
  const r = {
    ginasio: noMes(dados.ginasio),
    cycling: noMes(dados.cycling),
    falhados: noMes(dados.falhados),
    aguaDias: litros.length,
    aguaTotal: litros.reduce((soma, valor) => soma + valor, 0),
    jejum2r: noMes(dados.jejum2r),
    jejum1r: noMes(dados.jejum1r),
    jejum36h: noMes(dados.jejum36h),
    tabacoSem: noMes(dados.tabacoSem),
    tabacoConsumo: noMes(dados.tabacoConsumo),
    alcoolSem: noMes(dados.alcoolSem),
    alcoolConsumo: noMes(dados.alcoolConsumo),
    comprados,
  };
  r.exercicio = r.ginasio + r.cycling;
  r.aguaMedia = r.aguaDias ? r.aguaTotal / r.aguaDias : 0;
  r.jejum = r.jejum2r + r.jejum1r + r.jejum36h;
  r.temRegistos = r.exercicio + r.falhados + r.aguaDias + r.jejum + r.tabacoSem + r.tabacoConsumo
    + r.alcoolSem + r.alcoolConsumo + r.comprados > 0;
  return r;
}

// Ex.: "+3 face a out." ou "igual a out.". Sem registos no mês anterior, não compara.
function comparacao(atual, anterior, resumoAnterior, mesAnterior, unidade = '') {
  if (!resumoAnterior.temRegistos) return null;
  const abreviado = `${MESES_ABREVIADOS[mesAnterior.getMonth()]}.`;
  const diferenca = Math.round((atual - anterior) * 10) / 10;
  if (diferenca === 0) return `igual a ${abreviado}`;
  const sinal = diferenca > 0 ? '+' : '−';
  return `${sinal}${numeroCurto(Math.abs(diferenca))}${unidade} face a ${abreviado}`;
}

// Cartão com valor grande, legenda pequena e, se houver, pormenor, comparação e barra de progresso.
function cartaoMes({ valor, legenda, pormenor, comparar, progresso, largo }) {
  const filhos = [
    criar('p', { className: 'mes-valor', textContent: valor }),
    criar('p', { className: 'mes-legenda', textContent: legenda }),
  ];
  if (progresso) {
    const percentagem = Math.min(100, Math.round((progresso.feito / progresso.meta) * 100));
    const barra = criar('div', {
      className: 'mes-barra',
      'aria-label': progresso.texto,
      'aria-valuemin': '0',
      'aria-valuemax': String(progresso.meta),
      'aria-valuenow': String(Math.min(progresso.feito, progresso.meta)),
    }, criar('span', {}));
    barra.setAttribute('role', 'progressbar');
    barra.firstChild.style.width = `${percentagem}%`;
    barra.classList.toggle('mes-barra-cheia', progresso.feito >= progresso.meta);
    filhos.push(barra, criar('p', { className: 'mes-pormenor', textContent: progresso.texto }));
  }
  if (pormenor) filhos.push(criar('p', { className: 'mes-pormenor', textContent: pormenor }));
  if (comparar) filhos.push(criar('p', { className: 'mes-comparacao', textContent: comparar }));
  return criar('li', { className: largo ? 'mes-cartao mes-cartao-largo' : 'mes-cartao' }, ...filhos);
}

function plural(numero, singular, varios) {
  return `${numero} ${numero === 1 ? singular : varios}`;
}

function cartoesDoMes(mes, r, anterior, a) {
  const comparar = (atual, antes, unidade) => comparacao(atual, antes, a, anterior, unidade);
  // Meta do mês: o mínimo semanal de exercício, proporcional aos dias do mês.
  const meta = Math.round((dados.ajustes.ginasioMin * diasNoMes(mes)) / 7);
  const cartoes = [
    cartaoMes({
      largo: true,
      valor: String(r.exercicio),
      legenda: r.exercicio === 1 ? 'dia de exercício' : 'dias de exercício',
      pormenor: `${r.ginasio} ginásio · ${r.cycling} cycling · ${plural(r.falhados, 'falhado', 'falhados')}`,
      comparar: comparar(r.exercicio, a.exercicio),
      progresso: meta > 0 ? { feito: r.exercicio, meta, texto: `${r.exercicio} de ${meta} (mínimo de ${dados.ajustes.ginasioMin} por semana)` } : null,
    }),
    cartaoMes({
      valor: r.aguaDias ? rotuloAgua(Math.round(r.aguaMedia * 10) / 10) : '—',
      legenda: 'água por dia, em média',
      pormenor: r.aguaDias ? `${plural(r.aguaDias, 'dia', 'dias')} · ${numeroCurto(r.aguaTotal)} L no total` : 'Sem registos',
      comparar: r.aguaDias && a.aguaDias ? comparar(r.aguaMedia, a.aguaMedia, ' L') : null,
    }),
    cartaoMes({
      valor: String(r.jejum),
      legenda: r.jejum === 1 ? 'dia de jejum' : 'dias de jejum',
      pormenor: `${r.jejum2r} de 2R · ${r.jejum1r} de 1R · ${r.jejum36h} de 36\u00a0h`,
      comparar: comparar(r.jejum, a.jejum),
    }),
    cartaoMes({
      valor: String(r.tabacoSem),
      legenda: r.tabacoSem === 1 ? 'dia sem tabaco' : 'dias sem tabaco',
      pormenor: `${r.tabacoConsumo} com consumo`,
      comparar: comparar(r.tabacoSem, a.tabacoSem),
    }),
    cartaoMes({
      valor: String(r.alcoolSem),
      legenda: r.alcoolSem === 1 ? 'dia sem álcool' : 'dias sem álcool',
      pormenor: `${r.alcoolConsumo} com consumo`,
      comparar: comparar(r.alcoolSem, a.alcoolSem),
    }),
  ];
  // As compras só começaram a ser contadas com o botão "Limpar comprados": sem nenhuma, o cartão não aparece.
  if (r.comprados > 0) {
    cartoes.push(cartaoMes({
      largo: true,
      valor: String(r.comprados),
      legenda: r.comprados === 1 ? 'produto comprado' : 'produtos comprados',
      pormenor: 'Contados com "Limpar comprados", na vista Compras',
    }));
  }
  return cartoes;
}

function desenharLembreteCopia() {
  const texto = textoLembreteCopia();
  const lembrete = document.getElementById('mes-lembrete');
  lembrete.hidden = !texto;
  if (texto) document.getElementById('mes-lembrete-texto').textContent = texto;
}

function desenharNotasMes(mes) {
  const campo = document.getElementById('mes-notas');
  const chave = chaveMes(mes);
  // Enquanto se escreve, não se mexe no texto (ex.: a app voltou a ficar visível).
  if (document.activeElement === campo && campo.dataset.mes === chave) return;
  campo.dataset.mes = chave;
  campo.value = dados.notasMes[chave] || '';
  document.getElementById('mes-notas-titulo').textContent = `Notas de ${NOMES_MESES[mes.getMonth()]}`;
}

function desenharMes() {
  const mes = inicioDoMes(mesDeslocamento);
  const anterior = inicioDoMes(mesDeslocamento - 1);
  const r = resumoDoMes(mes);

  document.getElementById('mes-titulo').textContent = `${NOMES_MESES[mes.getMonth()]} de ${mes.getFullYear()}`;
  document.getElementById('mes-hoje').hidden = mesDeslocamento === 0;
  desenharLembreteCopia();

  const caixa = document.getElementById('mes-cartoes');
  if (r.temRegistos) {
    caixa.replaceChildren(criar('ul', { className: 'mes-grelha' }, ...cartoesDoMes(mes, r, anterior, resumoDoMes(anterior))));
  } else {
    caixa.replaceChildren(criar('div', { className: 'mes-vazio' },
      criar('p', { className: 'mes-vazio-titulo', textContent: `Nada registado em ${NOMES_MESES[mes.getMonth()]}.` }),
      criar('p', { textContent: 'Os dias marcados na Semana e nos Suplementos aparecem aqui.' })));
  }
  desenharNotasMes(mes);
}

function mudarMes(deslocamento) {
  mesDeslocamento = deslocamento;
  desenharMes();
}

const campoNotas = document.getElementById('mes-notas');
campoNotas.addEventListener('input', () => {
  const chave = campoNotas.dataset.mes;
  if (!chave) return;
  if (campoNotas.value.trim()) dados.notasMes[chave] = campoNotas.value;
  else delete dados.notasMes[chave];
  guardarDados();
});
document.getElementById('mes-anterior').addEventListener('click', () => mudarMes(mesDeslocamento - 1));
document.getElementById('mes-seguinte').addEventListener('click', () => mudarMes(mesDeslocamento + 1));
document.getElementById('mes-hoje').addEventListener('click', () => mudarMes(0));
document.getElementById('mes-exportar').addEventListener('click', exportarCopia);

desenhar.mes = desenharMes;
