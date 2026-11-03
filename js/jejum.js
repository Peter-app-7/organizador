// jejum.js: secção Jejum da vista Suplementos, com o mesmo modelo dos dias de ginásio da vista Semana.
// Sete quadrados, de segunda a domingo. Tocar muda o estado do dia: sem jejum, 2R, 1R, 36h e de volta a sem jejum.

// A ordem desta lista é a ordem dos toques. "lista" é o sítio dos dados onde ficam os dias desse tipo.
const TIPOS_JEJUM = [
  { id: '2r', lista: 'jejum2r', curto: '2R', nome: 'Intermitente (2 refeições por dia)', legenda: 'intermitente (2 refeições)' },
  { id: '1r', lista: 'jejum1r', curto: '1R', nome: '1 refeição por dia', legenda: '1 refeição por dia' },
  { id: '36h', lista: 'jejum36h', curto: '36h', nome: '36 horas', legenda: '36 horas' },
];

// Semana mostrada, em semanas a contar da atual: 0 é esta, -1 a anterior, 1 a seguinte.
let jejumSemanas = 0;
// As últimas 36 horas passadas de um dia para outro: { para, de }. Até haver outro toque, dá para desfazer.
let jejumMovido = null;

function diasDoJejum() {
  const segunda = somarDias(segundaDaSemana(new Date()), 7 * jejumSemanas);
  return [0, 1, 2, 3, 4, 5, 6].map((n) => dataParaTexto(somarDias(segunda, n)));
}

function tipoJejumDoDia(texto) {
  return TIPOS_JEJUM.find((tipo) => dados[tipo.lista].includes(texto)) || null;
}

function retirarJejum(texto) {
  TIPOS_JEJUM.forEach((tipo) => {
    dados[tipo.lista] = dados[tipo.lista].filter((dia) => dia !== texto);
  });
}

// Ex.: "Sex 6".
function rotuloDiaJejum(texto) {
  const data = textoParaData(texto);
  return `${ABREVIATURAS_DIAS[(data.getDay() + 6) % 7]} ${data.getDate()}`;
}

function mudarJejumDia(texto) {
  const seguinte = TIPOS_JEJUM[TIPOS_JEJUM.indexOf(tipoJejumDoDia(texto)) + 1] || null;
  const movido = jejumMovido;
  jejumMovido = null;

  retirarJejum(texto);
  if (seguinte) dados[seguinte.lista].push(texto);

  if (seguinte && seguinte.id === '36h') {
    // Só um dia de 36 horas por semana: passa do dia anterior para este.
    const outros = diasDoJejum().filter((dia) => dia !== texto && dados.jejum36h.includes(dia));
    if (outros.length > 0) {
      outros.forEach(retirarJejum);
      jejumMovido = { para: texto, de: outros[0] };
      avisar(`36 h passou de ${rotuloDiaJejum(outros[0])} para ${rotuloDiaJejum(texto)}.`);
    }
  } else if (!seguinte && movido && movido.para === texto) {
    // Passar por 36 horas é inevitável para chegar a "sem jejum": se foi só isso, as 36 horas voltam ao dia onde estavam.
    dados.jejum36h.push(movido.de);
    avisar(`36 h voltou a ${rotuloDiaJejum(movido.de)}.`);
  }

  guardarDados();
  desenharJejum();
}

function mudarSemanaJejum(semanas) {
  jejumSemanas = semanas;
  jejumMovido = null;
  desenharJejum();
}

function desenharJejum() {
  const dias = diasDoJejum();
  const hoje = dataParaTexto(new Date());
  const contar = (tipo) => dias.filter((dia) => dados[tipo.lista].includes(dia)).length;
  const [dois, um, trinta] = TIPOS_JEJUM.map(contar);
  const total = dois + um + trinta;

  const primeiro = textoParaData(dias[0]);
  const ultimo = textoParaData(dias[6]);
  document.getElementById('jejum-titulo').textContent =
    `${formatarData(primeiro, { day: 'numeric', month: 'short' })} a ${formatarData(ultimo, { day: 'numeric', month: 'short', year: 'numeric' })}`
      .replace(/\./g, '');

  document.getElementById('jejum-resumo').replaceChildren(
    `Jejum: ${total} ${total === 1 ? 'dia' : 'dias'} · ${trinta} de 36 h`,
    ' ',
    criar('span', { className: 'resumo-divisao', textContent: `${dois} de 2R · ${um} de 1R` }),
  );

  document.getElementById('jejum-dias').replaceChildren(...dias.map((texto, i) => {
    const data = textoParaData(texto);
    const tipo = tipoJejumDoDia(texto);
    const nome = formatarData(data, { weekday: 'long', day: 'numeric', month: 'long' });
    const botao = criar('button', {
      type: 'button',
      className: texto === hoje ? 'dia dia-hoje' : 'dia',
      'aria-label': `${nome}: ${tipo ? tipo.nome : 'sem jejum'}`,
      onclick: () => mudarJejumDia(texto),
    },
    criar('span', { className: 'dia-nome', textContent: ABREVIATURAS_DIAS[i] }),
    criar('span', { className: 'dia-numero', textContent: String(data.getDate()) }),
    // No lugar do ícone do ginásio, com a mesma altura.
    criar('span', { className: 'dia-jejum', textContent: tipo ? tipo.curto : '' }));
    botao.dataset.jejum = tipo ? tipo.id : 'nenhum';
    return criar('li', {}, botao);
  }));

  document.getElementById('jejum-legenda').replaceChildren(...TIPOS_JEJUM.map((tipo) => {
    const item = criar('li', {}, criar('span', { className: 'jejum-cor', 'aria-hidden': 'true' }), `${tipo.curto}: ${tipo.legenda}`);
    item.dataset.jejum = tipo.id;
    return item;
  }));
}

document.getElementById('jejum-anterior').addEventListener('click', () => mudarSemanaJejum(jejumSemanas - 1));
document.getElementById('jejum-hoje').addEventListener('click', () => mudarSemanaJejum(0));
document.getElementById('jejum-seguinte').addEventListener('click', () => mudarSemanaJejum(jejumSemanas + 1));

desenhar.suplementos = () => {
  desenharSuplementos();
  desenharJejum();
};
