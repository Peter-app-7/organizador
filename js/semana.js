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
  dados.ginasio = dados.ginasio.filter((dia) => dia !== texto);
  dados.cycling = dados.cycling.filter((dia) => dia !== texto);

  if (estado === 'nada') {
    const marcados = contarNaSemana(dados.ginasio);
    if (marcados >= dados.ajustes.ginasioMax) {
      // Com o máximo atingido, o estado Ginásio é saltado: o dia passa logo a Cycling.
      avisar(`Já tens ${marcados} dias de ginásio, o máximo é ${dados.ajustes.ginasioMax}. Este dia ficou em Cycling.`);
      dados.cycling.push(texto);
    } else {
      dados.ginasio.push(texto);
    }
  } else if (estado === 'ginasio') {
    dados.cycling.push(texto);
  }

  guardarDados();
  desenharSemana();
}

function desenharSemana() {
  const dias = diasDaSemanaMostrada();
  const { ginasioMin, ginasioMax } = dados.ajustes;
  const marcados = contarNaSemana(dados.ginasio);
  const diasCycling = contarNaSemana(dados.cycling);
  const hoje = dataParaTexto(new Date());

  document.getElementById('semana-titulo').textContent =
    `${formatarData(dias[0], { day: 'numeric', month: 'short' })} a ${formatarData(dias[6], { day: 'numeric', month: 'short', year: 'numeric' })}`
      .replace(/\./g, '');

  const resumo = document.getElementById('semana-resumo');
  const cumprido = marcados >= ginasioMin;
  resumo.textContent = `Ginásio: ${marcados} de ${ginasioMin} mínimo${cumprido ? ' ✓' : ''} · máximo ${ginasioMax}`;
  resumo.classList.toggle('resumo-falta', !cumprido);
  document.getElementById('semana-cycling').textContent = `Cycling: ${diasCycling} ${diasCycling === 1 ? 'dia' : 'dias'}`;

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
