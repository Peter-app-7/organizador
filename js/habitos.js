// habitos.js: menus de Tabaco e de Álcool da vista Semana, com os mesmos quadrados e a mesma semana do ginásio.
// Tocar muda o estado do dia: por marcar, sem consumo (verde), consumi (vermelho) e de volta a por marcar.

// "sem" e "consumo" são os sítios dos dados onde ficam os dias de cada estado.
const HABITOS = [
  { id: 'tabaco', titulo: 'Tabaco', sem: 'tabacoSem', consumo: 'tabacoConsumo', textoSem: 'sem tabaco' },
  { id: 'alcool', titulo: 'Álcool', sem: 'alcoolSem', consumo: 'alcoolConsumo', textoSem: 'sem álcool' },
];

function estadoHabito(habito, texto) {
  if (dados[habito.sem].includes(texto)) return 'sem';
  if (dados[habito.consumo].includes(texto)) return 'consumo';
  return 'nada';
}

function mudarEstadoHabito(habito, texto) {
  const estado = estadoHabito(habito, texto);
  dados[habito.sem] = dados[habito.sem].filter((dia) => dia !== texto);
  dados[habito.consumo] = dados[habito.consumo].filter((dia) => dia !== texto);
  if (estado === 'nada') dados[habito.sem].push(texto);
  if (estado === 'sem') dados[habito.consumo].push(texto);
  guardarDados();
  desenharHabitos();
}

function secaoHabito(habito) {
  const descricoes = { nada: 'por marcar', sem: habito.textoSem, consumo: 'consumi' };
  return criar('div', { id: `habito-${habito.id}` },
    criar('h2', { textContent: habito.titulo }),
    criar('ul', { className: 'quadrados' }, ...diasDaSemanaMostrada().map((dia, i) => {
      const texto = dataParaTexto(dia);
      const estado = estadoHabito(habito, texto);
      return criar('li', {}, botaoDia(dia, i, estado, `${habito.titulo}, ${descricoes[estado]}`, () => mudarEstadoHabito(habito, texto)));
    })));
}

function desenharHabitos() {
  document.getElementById('habitos').replaceChildren(...HABITOS.map(secaoHabito));
}

desenhar.semana = () => {
  desenharSemana();
  desenharHabitos();
};
