// jejum.js: secção Jejum da vista Suplementos. Um tipo de jejum por dia da semana, que se repete todas as semanas.
// Por isso guarda-se por posição (segunda = 0 ... domingo = 6) e não por data, como os dias de ginásio.

const NOMES_DIAS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

// Dia com a escolha aberta (0 a 6), ou null. Só em memória: a app abre sempre com a escolha fechada.
let jejumAEscolher = null;

function tipoJejum(id) {
  return TIPOS_JEJUM.find((tipo) => tipo.id === id);
}

function escolherJejum(indice, id) {
  // O jejum de 36 horas só pode estar num dia: passa do dia anterior para este.
  const anterior = id === '36h' ? dados.jejum.findIndex((tipo, i) => tipo === '36h' && i !== indice) : -1;
  if (anterior !== -1) {
    dados.jejum[anterior] = 'nenhum';
    avisar(`36 horas passou de ${NOMES_DIAS[anterior]} para ${NOMES_DIAS[indice]}.`);
  }
  dados.jejum[indice] = id;
  jejumAEscolher = null;
  guardarDados();
  desenharJejum();
}

function celulaJejum(id, indice, indiceHoje) {
  const aberta = jejumAEscolher === indice;
  const botao = criar('button', {
    type: 'button',
    className: ['dia', 'jejum-dia', indice === indiceHoje && 'dia-hoje', aberta && 'dia-selecionado'].filter(Boolean).join(' '),
    'aria-label': `${NOMES_DIAS[indice]}: ${tipoJejum(id).nome}${indice === indiceHoje ? ', hoje' : ''}`,
    'aria-expanded': String(aberta),
    'aria-controls': 'jejum-escolha',
    onclick: () => {
      jejumAEscolher = aberta ? null : indice;
      desenharJejum();
    },
  },
  criar('span', { className: 'dia-nome', textContent: ABREVIATURAS_DIAS[indice] }),
  criar('span', { className: 'dia-numero jejum-curto', textContent: tipoJejum(id).curto }));
  botao.dataset.jejum = id;
  return criar('li', {}, botao);
}

function opcaoJejum(tipo, indice) {
  const botao = criar('button', {
    type: 'button',
    className: 'jejum-opcao',
    'aria-pressed': String(dados.jejum[indice] === tipo.id),
    onclick: () => escolherJejum(indice, tipo.id),
  },
  criar('span', { className: 'jejum-cor', 'aria-hidden': 'true' }),
  tipo.nome);
  botao.dataset.jejum = tipo.id;
  return botao;
}

function desenharJejum() {
  const indiceHoje = (new Date().getDay() + 6) % 7; // segunda = 0 ... domingo = 6
  document.getElementById('jejum-dias').replaceChildren(
    ...dados.jejum.map((id, indice) => celulaJejum(id, indice, indiceHoje)),
  );

  const escolha = document.getElementById('jejum-escolha');
  escolha.hidden = jejumAEscolher === null;
  if (jejumAEscolher === null) {
    escolha.replaceChildren();
  } else {
    escolha.setAttribute('aria-label', `Jejum de ${NOMES_DIAS[jejumAEscolher]}`);
    escolha.replaceChildren(
      criar('h3', { className: 'momento-titulo', textContent: NOMES_DIAS[jejumAEscolher] }),
      ...TIPOS_JEJUM.map((tipo) => opcaoJejum(tipo, jejumAEscolher)),
    );
  }

  document.getElementById('jejum-legenda').replaceChildren(...TIPOS_JEJUM.filter((tipo) => tipo.curto).map((tipo) => {
    const item = criar('li', {}, criar('span', { className: 'jejum-cor', 'aria-hidden': 'true' }), `${tipo.curto}: ${tipo.legenda}`);
    item.dataset.jejum = tipo.id;
    return item;
  }));
}

// Tocar fora da secção fecha a escolha. A célula tocada é substituída ao desenhar,
// por isso compara-se o caminho do toque, que não muda.
document.addEventListener('click', (evento) => {
  if (jejumAEscolher === null || evento.composedPath().includes(document.getElementById('jejum'))) return;
  jejumAEscolher = null;
  desenharJejum();
});

desenhar.suplementos = () => {
  desenharSuplementos();
  desenharJejum();
};
