// receitas.js: vista Receitas. Os textos estão em receitas-dados.js.

// Modos de confecção abertos: só em memória, por isso a app abre sempre com todos fechados.
const receitasAbertas = new Set();

function atualizarContadorReceitas() {
  const feitas = RECEITAS.filter((r) => dados.receitasFeitas.includes(r.id)).length;
  document.getElementById('receitas-contador').textContent = `${feitas} de ${RECEITAS.length} feitas esta semana`;
}

function marcarReceita(receita, feita, cartao) {
  dados.receitasFeitas = dados.receitasFeitas.filter((id) => id !== receita.id);
  if (feita) dados.receitasFeitas.push(receita.id);
  guardarDados();
  // Muda só este cartão, sem redesenhar a lista, para a transição se ver.
  cartao.classList.toggle('receita-feita', feita);
  atualizarContadorReceitas();
}

function alternarConfeccao(receita, botao, passos) {
  const aberta = !receitasAbertas.has(receita.id);
  if (aberta) receitasAbertas.add(receita.id);
  else receitasAbertas.delete(receita.id);
  botao.setAttribute('aria-expanded', String(aberta));
  passos.hidden = !aberta;
}

function cartaoReceita(receita) {
  const feita = dados.receitasFeitas.includes(receita.id);
  const aberta = receitasAbertas.has(receita.id);
  const idPassos = `receita-passos-${receita.id}`;

  const botao = criar('button', {
    type: 'button',
    className: 'receita-abrir',
    textContent: 'Modo de confecção',
    'aria-expanded': String(aberta),
    'aria-controls': idPassos,
  });
  const passos = criar('div', { id: idPassos, className: 'receita-passos', hidden: !aberta },
    criar('ol', {}, ...receita.passos.map((passo) => criar('li', { textContent: passo }))),
    criar('p', { className: 'receita-nota' },
      criar('strong', { textContent: 'Nota para a bebé: ' }),
      receita.notaBebe));

  const caixa = criar('input', {
    type: 'checkbox',
    className: 'receita-caixa',
    checked: feita,
    'aria-label': `Feita esta semana: ${receita.titulo}`,
  });
  const cartao = criar('article', { className: feita ? 'receita receita-feita' : 'receita' },
    criar('div', { className: 'receita-topo' },
      criar('label', { className: 'receita-marca' }, caixa, criar('span', { className: 'receita-visto' })),
      criar('h2', { className: 'receita-titulo', textContent: receita.titulo })),
    criar('p', { className: 'receita-ingredientes', textContent: receita.ingredientes.join(' · ') }),
    botao,
    passos);

  caixa.addEventListener('change', () => marcarReceita(receita, caixa.checked, cartao));
  // Tocar no cartão abre ou fecha, exceto na caixa e nos passos abertos (para não fechar a meio de cozinhar).
  cartao.addEventListener('click', (evento) => {
    if (evento.target.closest('.receita-marca, .receita-passos')) return;
    alternarConfeccao(receita, botao, passos);
  });
  return cartao;
}

function desenharReceitas() {
  atualizarContadorReceitas();
  document.getElementById('receitas-lista').replaceChildren(...RECEITAS.map(cartaoReceita));
}

document.getElementById('receitas-nota').textContent = RECEITAS_NOTA;
document.getElementById('receitas-nova-semana').addEventListener('click', () => {
  if (!confirm('Desmarcar todas as receitas?')) return;
  dados.receitasFeitas = [];
  guardarDados();
  desenharReceitas();
});

desenhar.receitas = desenharReceitas;
