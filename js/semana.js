// semana.js: vista Semana. Sete quadrados, de segunda a domingo. Tocar num quadrado muda o estado do dia:
// nada, Ginásio, Cycling e de volta a nada.

const ABREVIATURAS_DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const NOMES_ESTADOS = { nada: 'sem atividade', ginasio: 'Ginásio', cycling: 'Cycling' };

function somarDias(data, dias) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias);
}

function segundaDaSemana(data) {
  const diasDesdeSegunda = (data.getDay() + 6) % 7; // segunda = 0 ... domingo = 6
  return somarDias(data, -diasDesdeSegunda);
}

function semanaDeHoje() {
  return segundaDaSemana(new Date());
}

let semanaMostrada = semanaDeHoje();

function diasDaSemanaMostrada() {
  return [0, 1, 2, 3, 4, 5, 6].map((n) => somarDias(semanaMostrada, n));
}

function contarNaSemana(lista) {
  return diasDaSemanaMostrada().filter((dia) => lista.includes(dataParaTexto(dia))).length;
}

function estadoDoDia(texto) {
  if (dados.ginasio.includes(texto)) return 'ginasio';
  if (dados.cycling.includes(texto)) return 'cycling';
  return 'nada';
}

function mudarEstadoDia(texto) {
  const estado = estadoDoDia(texto);

  // Os limites são do exercício total: um dia vazio não pode ser marcado se o máximo já foi atingido.
  if (estado === 'nada') {
    const total = contarNaSemana(dados.ginasio) + contarNaSemana(dados.cycling);
    if (total >= dados.ajustes.ginasioMax) {
      avisar(`Já tens ${total} dias de exercício: o máximo é ${dados.ajustes.ginasioMax}.`);
      return;
    }
  }

  dados.ginasio = dados.ginasio.filter((dia) => dia !== texto);
  dados.cycling = dados.cycling.filter((dia) => dia !== texto);
  if (estado === 'nada') dados.ginasio.push(texto);
  if (estado === 'ginasio') dados.cycling.push(texto);

  guardarDados();
  desenharSemana();
}

function desenharSemana() {
  const dias = diasDaSemanaMostrada();
  const { ginasioMin, ginasioMax } = dados.ajustes;
  const diasGinasio = contarNaSemana(dados.ginasio);
  const diasCycling = contarNaSemana(dados.cycling);
  const total = diasGinasio + diasCycling;
  const hoje = dataParaTexto(new Date());

  document.getElementById('semana-titulo').textContent =
    `${formatarData(dias[0], { day: 'numeric', month: 'short' })} a ${formatarData(dias[6], { day: 'numeric', month: 'short', year: 'numeric' })}`
      .replace(/\./g, '');

  const resumo = document.getElementById('semana-resumo');
  resumo.replaceChildren(
    `Exercício: ${total} de ${ginasioMin} mínimo · máximo ${ginasioMax}`,
    ' ',
    criar('span', { className: 'resumo-divisao', textContent: `${diasGinasio} ginásio · ${diasCycling} cycling` }),
  );
  // Destaca o contador se faltar exercício, ou se dados antigos passarem o máximo.
  resumo.classList.toggle('resumo-falta', total < ginasioMin || total > ginasioMax);

  // Um quadrado por dia. O nome completo e o estado ficam no aria-label, para leitores de ecrã.
  document.getElementById('semana-dias').replaceChildren(...dias.map((dia, i) => {
    const texto = dataParaTexto(dia);
    const estado = estadoDoDia(texto);
    const nome = formatarData(dia, { weekday: 'long', day: 'numeric', month: 'long' });
    return criar('li', {}, criar('button', {
      type: 'button',
      className: texto === hoje ? 'dia dia-hoje' : 'dia',
      'aria-label': `${nome}: ${NOMES_ESTADOS[estado]}`,
      onclick: () => mudarEstadoDia(texto),
    },
    criar('span', { className: 'dia-nome', textContent: ABREVIATURAS_DIAS[i] }),
    criar('span', { className: 'dia-numero', textContent: String(dia.getDate()) }),
    criar('span', { className: 'dia-icone' })));
  }));
  document.querySelectorAll('#semana-dias .dia').forEach((botao, i) => {
    botao.dataset.estado = estadoDoDia(dataParaTexto(dias[i]));
  });
}

document.getElementById('semana-anterior').addEventListener('click', () => {
  semanaMostrada = somarDias(semanaMostrada, -7);
  desenharSemana();
});
document.getElementById('semana-seguinte').addEventListener('click', () => {
  semanaMostrada = somarDias(semanaMostrada, 7);
  desenharSemana();
});
document.getElementById('semana-hoje').addEventListener('click', () => {
  semanaMostrada = semanaDeHoje();
  desenharSemana();
});

desenhar.semana = () => {
  desenharSemana();
  desenharSuplementos();
};
