// semana.js: vista Semana. Sete quadrados, de segunda a domingo. Tocar num quadrado muda o estado do dia:
// nada, Ginásio, Cycling, Natação, Falhado e de volta a nada. Por baixo de cada dia aparece a água desse dia, só para consulta.

const ABREVIATURAS_DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const NOMES_ESTADOS = { nada: 'sem atividade', ginasio: 'Ginásio', cycling: 'Cycling', natacao: 'Natação', falhado: 'Falhado' };

function somarDias(data, dias) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias);
}

function segundaDaSemana(data) {
  const diasDesdeSegunda = (data.getDay() + 6) % 7; // segunda = 0 ... domingo = 6
  return somarDias(data, -diasDesdeSegunda);
}

let diaSelecionado = somarDias(new Date(), 0);
let hojeConhecido = dataParaTexto(new Date());

function selecionarDia(data) {
  diaSelecionado = data;
  desenhar.semana();
}

// Se o dia mudar com a app aberta e estivesses a ver "hoje", continuas a ver o novo "hoje".
aoAbrir.push(() => {
  const hoje = dataParaTexto(new Date());
  if (hoje === hojeConhecido) return;
  if (dataParaTexto(diaSelecionado) === hojeConhecido) diaSelecionado = somarDias(new Date(), 0);
  hojeConhecido = hoje;
});

function diasDaSemanaMostrada() {
  const segunda = segundaDaSemana(diaSelecionado);
  return [0, 1, 2, 3, 4, 5, 6].map((n) => somarDias(segunda, n));
}

function contarNaSemana(lista) {
  return diasDaSemanaMostrada().filter((dia) => lista.includes(dataParaTexto(dia))).length;
}

function estadoDoDia(texto) {
  if (dados.ginasio.includes(texto)) return 'ginasio';
  if (dados.cycling.includes(texto)) return 'cycling';
  if (dados.natacao.includes(texto)) return 'natacao';
  if (dados.falhados.includes(texto)) return 'falhado';
  return 'nada';
}

function mudarEstadoDia(texto) {
  const estado = estadoDoDia(texto);

  // Os limites são do exercício total, sem os dias falhados: um dia vazio não pode ser marcado
  // se o máximo já foi atingido.
  if (estado === 'nada') {
    const total = contarNaSemana(dados.ginasio) + contarNaSemana(dados.cycling) + contarNaSemana(dados.natacao);
    if (total >= dados.ajustes.ginasioMax) {
      avisar(`Já tens ${total} dias de exercício: o máximo é ${dados.ajustes.ginasioMax}.`);
      return;
    }
  }

  dados.ginasio = dados.ginasio.filter((dia) => dia !== texto);
  dados.cycling = dados.cycling.filter((dia) => dia !== texto);
  dados.natacao = dados.natacao.filter((dia) => dia !== texto);
  dados.falhados = dados.falhados.filter((dia) => dia !== texto);
  if (estado === 'nada') dados.ginasio.push(texto);
  if (estado === 'ginasio') dados.cycling.push(texto);
  if (estado === 'cycling') dados.natacao.push(texto);
  if (estado === 'natacao') dados.falhados.push(texto);

  guardarDados();
  desenharSemana();
}

// Um quadrado de um dia, igual em todos os menus da vista. O nome completo e o estado ficam no aria-label, para leitores de ecrã.
function botaoDia(dia, indice, estado, descricao, aoTocar) {
  const texto = dataParaTexto(dia);
  const selecionado = texto === dataParaTexto(diaSelecionado);
  const nome = formatarData(dia, { weekday: 'long', day: 'numeric', month: 'long' });
  const botao = criar('button', {
    type: 'button',
    className: ['dia', texto === dataParaTexto(new Date()) && 'dia-hoje', selecionado && 'dia-selecionado'].filter(Boolean).join(' '),
    'aria-label': `${nome}: ${descricao}${selecionado ? ', dia selecionado' : ''}`,
    onclick: aoTocar,
  },
  criar('span', { className: 'dia-nome', textContent: ABREVIATURAS_DIAS[indice] }),
  criar('span', { className: 'dia-numero', textContent: String(dia.getDate()) }),
  criar('span', { className: 'dia-icone' }));
  botao.dataset.estado = estado;
  return botao;
}

function desenharSemana() {
  const dias = diasDaSemanaMostrada();
  const { ginasioMin, ginasioMax } = dados.ajustes;
  const diasGinasio = contarNaSemana(dados.ginasio);
  const diasCycling = contarNaSemana(dados.cycling);
  const diasNatacao = contarNaSemana(dados.natacao);
  const total = diasGinasio + diasCycling + diasNatacao;
  const diasFalhados = contarNaSemana(dados.falhados);

  document.getElementById('semana-titulo').textContent =
    `${formatarData(dias[0], { day: 'numeric', month: 'short' })} a ${formatarData(dias[6], { day: 'numeric', month: 'short', year: 'numeric' })}`
      .replace(/\./g, '');

  const resumo = document.getElementById('semana-resumo');
  resumo.replaceChildren(
    `Exercício: ${total} de ${ginasioMin} mínimo · máximo ${ginasioMax}`,
    ' ',
    criar('span', { className: 'resumo-divisao', textContent: `${diasGinasio} ginásio · ${diasCycling} cycling · ${diasNatacao} natação · ${diasFalhados} ${diasFalhados === 1 ? 'falhado' : 'falhados'}` }),
  );
  // Destaca o contador se faltar exercício, ou se dados antigos passarem o máximo.
  resumo.classList.toggle('resumo-falta', total < ginasioMin || total > ginasioMax);

  document.getElementById('semana-dias').replaceChildren(...dias.map((dia, i) => {
    const texto = dataParaTexto(dia);
    const estado = estadoDoDia(texto);
    const litros = aguaDoDia(texto);
    const descricaoAgua = litros ? `, água ${rotuloAgua(litros)}` : '';
    return criar('li', {},
      botaoDia(dia, i, estado, `${NOMES_ESTADOS[estado]}${descricaoAgua}`, () => mudarEstadoDia(texto)),
      ...(litros ? [criar('span', { className: 'dia-agua', textContent: rotuloAgua(litros), 'aria-hidden': 'true' })] : []));
  }));
}

document.getElementById('semana-anterior').addEventListener('click', () => selecionarDia(somarDias(diaSelecionado, -7)));
document.getElementById('dia-anterior').addEventListener('click', () => selecionarDia(somarDias(diaSelecionado, -1)));
document.getElementById('semana-hoje').addEventListener('click', () => selecionarDia(somarDias(new Date(), 0)));
document.getElementById('dia-seguinte').addEventListener('click', () => selecionarDia(somarDias(diaSelecionado, 1)));
document.getElementById('semana-seguinte').addEventListener('click', () => selecionarDia(somarDias(diaSelecionado, 7)));

// A vista Semana tem os dias de ginásio e, por baixo, o Jejum (jejum.js).
// O Tabaco e o Álcool foram retirados do ecrã; os dias já marcados continuam guardados e nas cópias de segurança.
desenhar.semana = () => {
  desenharSemana();
  desenharJejum();
};
