// semana.js: vista Semana. Dias de segunda a sexta, onde se marcam os dias de ginásio.

const ABREVIATURAS_DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];

function somarDias(data, dias) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias);
}

function segundaDaSemana(data) {
  const diasDesdeSegunda = (data.getDay() + 6) % 7; // segunda = 0 ... domingo = 6
  return somarDias(data, -diasDesdeSegunda);
}

// Ao sábado e ao domingo, a semana útil já acabou: mostra logo a seguinte.
function semanaDeHoje() {
  const hoje = new Date();
  const segunda = segundaDaSemana(hoje);
  const fimDeSemana = hoje.getDay() === 0 || hoje.getDay() === 6;
  return fimDeSemana ? somarDias(segunda, 7) : segunda;
}

let semanaMostrada = semanaDeHoje();

function diasDaSemanaMostrada() {
  return [0, 1, 2, 3, 4].map((n) => somarDias(semanaMostrada, n));
}

function alternarGinasio(texto) {
  if (dados.ginasio.includes(texto)) {
    dados.ginasio = dados.ginasio.filter((dia) => dia !== texto);
  } else {
    const marcados = diasDaSemanaMostrada().filter((dia) => dados.ginasio.includes(dataParaTexto(dia))).length;
    if (marcados >= dados.ajustes.ginasioMax) {
      avisar(`Já tens ${marcados} dias marcados: o máximo são ${dados.ajustes.ginasioMax}.`);
      return;
    }
    dados.ginasio.push(texto);
  }
  guardarDados();
  desenharSemana();
}

function desenharSemana() {
  const dias = diasDaSemanaMostrada();
  const { ginasioMin, ginasioMax } = dados.ajustes;
  const marcados = dias.filter((dia) => dados.ginasio.includes(dataParaTexto(dia))).length;
  const hoje = dataParaTexto(new Date());

  document.getElementById('semana-titulo').textContent =
    `${formatarData(dias[0], { day: 'numeric', month: 'short' })} a ${formatarData(dias[4], { day: 'numeric', month: 'short', year: 'numeric' })}`
      .replace(/\./g, '');

  const resumo = document.getElementById('semana-resumo');
  const cumprido = marcados >= ginasioMin;
  resumo.textContent = `Ginásio: ${marcados} de ${ginasioMin} mínimo${cumprido ? ' ✓' : ''} · máximo ${ginasioMax}`;
  resumo.classList.toggle('resumo-falta', !cumprido);

  // Um quadrado por dia. O nome completo fica no aria-label, para leitores de ecrã.
  document.getElementById('semana-dias').replaceChildren(...dias.map((dia, i) => {
    const texto = dataParaTexto(dia);
    const marcado = dados.ginasio.includes(texto);
    const nome = formatarData(dia, { weekday: 'long', day: 'numeric', month: 'long' });
    return criar('li', {}, criar('button', {
      type: 'button',
      className: texto === hoje ? 'dia dia-hoje' : 'dia',
      'aria-pressed': String(marcado),
      'aria-label': `${nome}: ginásio`,
      onclick: () => alternarGinasio(texto),
    },
    criar('span', { className: 'dia-nome', textContent: ABREVIATURAS_DIAS[i] }),
    criar('span', { className: 'dia-numero', textContent: String(dia.getDate()) }),
    criar('span', { className: 'haltere' })));
  }));
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
