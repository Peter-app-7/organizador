// semana.js: vista Semana. Navegação por semanas e resumo do exercício no topo e, por baixo, um menu para cada
// categoria (Ginásio, Cycling e Natação), cada um com os seus sete quadrados, de segunda a domingo.
// Cada dia tem um só estado (um dia conta uma vez): num menu, tocar muda o dia de nada para essa categoria,
// depois para Falhado e de volta a nada. Falhado é do dia (sem exercício), por isso aparece nos três menus.
// Um dia já marcado noutra categoria aparece esbatido, com o ícone dela, e não muda: avisa onde o desmarcar.

const ABREVIATURAS_DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const NOMES_ESTADOS = { nada: 'sem atividade', ginasio: 'Ginásio', cycling: 'Cycling', natacao: 'Natação', falhado: 'Falhado' };
// Os menus de exercício, por esta ordem. "lista" é o sítio dos dados onde ficam os dias dessa categoria.
const CATEGORIAS_EXERCICIO = [
  { id: 'ginasio', lista: 'ginasio', titulo: 'Ginásio' },
  { id: 'cycling', lista: 'cycling', titulo: 'Cycling' },
  { id: 'natacao', lista: 'natacao', titulo: 'Natação' },
];

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

function totalExercicio() {
  return CATEGORIAS_EXERCICIO.reduce((soma, c) => soma + contarNaSemana(dados[c.lista]), 0);
}

// Toque num dia do menu de uma categoria: nada -> categoria -> Falhado -> nada.
function mudarEstadoDia(categoria, texto) {
  const estado = estadoDoDia(texto);

  // Um dia só conta uma vez: se já tem outra categoria, não muda.
  if (estado !== 'nada' && estado !== 'falhado' && estado !== categoria.id) {
    avisar(`${rotuloDiaJejum(texto)} já tem ${NOMES_ESTADOS[estado]}. Desmarca-o primeiro no menu ${NOMES_ESTADOS[estado]}.`);
    return;
  }

  // Os limites são do exercício total, sem os dias falhados: um dia vazio não pode ser marcado
  // se o máximo já foi atingido.
  if (estado === 'nada') {
    const total = totalExercicio();
    if (total >= dados.ajustes.ginasioMax) {
      avisar(`Já tens ${total} dias de exercício: o máximo é ${dados.ajustes.ginasioMax}.`);
      return;
    }
  }

  CATEGORIAS_EXERCICIO.forEach((c) => {
    dados[c.lista] = dados[c.lista].filter((dia) => dia !== texto);
  });
  dados.falhados = dados.falhados.filter((dia) => dia !== texto);
  if (estado === 'nada') dados[categoria.lista].push(texto);
  if (estado === categoria.id) dados.falhados.push(texto);

  guardarDados();
  desenharSemana();
}

// Quadrado compacto de um dia, o mesmo da linha de dias do Jejum: nome do dia, número e, por baixo, o rodapé
// (o tipo de jejum ou o ícone do exercício). Contorno no dia de hoje e, se pedido, o traço do dia selecionado.
// O nome completo e o estado ficam no aria-label, para leitores de ecrã.
function botaoDiaLinha({ texto, indice, descricao, rodape, aoTocar, selecionado = false }) {
  const data = textoParaData(texto);
  const nome = formatarData(data, { weekday: 'long', day: 'numeric', month: 'long' });
  return criar('button', {
    type: 'button',
    className: ['dia', texto === dataParaTexto(new Date()) && 'dia-hoje', selecionado && 'dia-selecionado'].filter(Boolean).join(' '),
    'aria-label': `${nome}: ${descricao}${selecionado ? ', dia selecionado' : ''}`,
    onclick: aoTocar,
  },
  criar('span', { className: 'dia-nome', textContent: ABREVIATURAS_DIAS[indice] }),
  criar('span', { className: 'dia-numero', textContent: String(data.getDate()) }),
  rodape);
}

function menuExercicio(categoria, dias) {
  const numero = contarNaSemana(dados[categoria.lista]);
  const selecionado = dataParaTexto(diaSelecionado);
  return criar('div', { className: 'exercicio-menu', id: `exercicio-${categoria.id}` },
    criar('div', { className: 'exercicio-cabecalho' },
      criar('h2', { textContent: categoria.titulo }),
      criar('span', { className: 'exercicio-contagem', textContent: `${numero} ${numero === 1 ? 'dia' : 'dias'}` })),
    criar('ul', { className: 'quadrados exercicio-dias' }, ...dias.map((dia, i) => {
      const texto = dataParaTexto(dia);
      const estado = estadoDoDia(texto);
      const outra = estado !== 'nada' && estado !== 'falhado' && estado !== categoria.id;
      const descricao = outra ? `${NOMES_ESTADOS[estado]}, marcado no menu ${NOMES_ESTADOS[estado]}`
        : `${categoria.titulo}, ${estado === 'nada' ? 'por marcar' : NOMES_ESTADOS[estado]}`;
      const botao = botaoDiaLinha({
        texto, indice: i, descricao, selecionado: texto === selecionado,
        rodape: criar('span', { className: 'dia-icone' }),
        aoTocar: () => mudarEstadoDia(categoria, texto),
      });
      botao.dataset.estado = outra ? 'outro' : estado;
      if (outra) botao.dataset.outro = estado;
      return criar('li', {}, botao);
    })));
}

function desenharSemana() {
  const dias = diasDaSemanaMostrada();
  const { ginasioMin, ginasioMax } = dados.ajustes;
  const [diasGinasio, diasCycling, diasNatacao] = CATEGORIAS_EXERCICIO.map((c) => contarNaSemana(dados[c.lista]));
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

  document.getElementById('exercicio-menus').replaceChildren(...CATEGORIAS_EXERCICIO.map((c) => menuExercicio(c, dias)));
}

document.getElementById('semana-anterior').addEventListener('click', () => selecionarDia(somarDias(diaSelecionado, -7)));
document.getElementById('dia-anterior').addEventListener('click', () => selecionarDia(somarDias(diaSelecionado, -1)));
document.getElementById('semana-hoje').addEventListener('click', () => selecionarDia(somarDias(new Date(), 0)));
document.getElementById('dia-seguinte').addEventListener('click', () => selecionarDia(somarDias(diaSelecionado, 1)));
document.getElementById('semana-seguinte').addEventListener('click', () => selecionarDia(somarDias(diaSelecionado, 7)));

// O Tabaco e o Álcool foram retirados do ecrã, e a água também (10 nov 2026); os dias já marcados continuam
// guardados e nas cópias de segurança. O Jejum está na vista Suplementos (jejum.js).
desenhar.semana = desenharSemana;
