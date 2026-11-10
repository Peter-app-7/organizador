// semana.js: vista Semana. Navegação por semanas e resumo do exercício no topo e, por baixo, um menu para cada
// categoria (Ginásio, Cycling e Natação), cada um com os seus sete quadrados, de segunda a domingo.
// Os menus são independentes: cada um guarda, para cada dia, o seu estado (por marcar, feito ou falhado), e tocar
// muda só esse menu: por marcar -> feito -> falhado -> por marcar. Um dia pode ter várias categorias feitas.
// O mínimo e o máximo contam dias distintos com pelo menos uma categoria feita; os falhados não contam.

const ABREVIATURAS_DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const NOMES_ESTADOS = { nada: 'por marcar', feito: 'feito', falhado: 'falhado' };
// Os menus de exercício, por esta ordem. "lista" e "falhados" são os sítios dos dados onde ficam os dias feitos e
// os dias falhados dessa categoria. "estado" é o data-estado do quadrado feito (dá a cor e o ícone).
const CATEGORIAS_EXERCICIO = [
  { id: 'ginasio', lista: 'ginasio', falhados: 'falhadosGinasio', titulo: 'Ginásio', resumo: 'ginásio' },
  { id: 'cycling', lista: 'cycling', falhados: 'falhadosCycling', titulo: 'Cycling', resumo: 'cycling' },
  { id: 'natacao', lista: 'natacao', falhados: 'falhadosNatacao', titulo: 'Natação', resumo: 'natação' },
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

// Estado de um dia num menu: 'nada', 'feito' ou 'falhado'.
function estadoDoDia(categoria, texto) {
  if (dados[categoria.lista].includes(texto)) return 'feito';
  if (dados[categoria.falhados].includes(texto)) return 'falhado';
  return 'nada';
}

// Dias distintos da semana mostrada com pelo menos uma categoria feita.
function diasDeExercicio() {
  return diasDaSemanaMostrada().map(dataParaTexto)
    .filter((texto) => CATEGORIAS_EXERCICIO.some((c) => dados[c.lista].includes(texto)));
}

// Toque num dia do menu de uma categoria: por marcar -> feito -> falhado -> por marcar. Só muda este menu.
function mudarEstadoDia(categoria, texto) {
  const estado = estadoDoDia(categoria, texto);

  // Os limites contam dias distintos de exercício, sem os falhados: um dia novo não pode ser marcado se o máximo
  // já foi atingido. Um dia que já conta (feito noutra categoria) não gasta outro dia.
  if (estado === 'nada') {
    const dias = diasDeExercicio();
    if (!dias.includes(texto) && dias.length >= dados.ajustes.ginasioMax) {
      avisar(`Já tens ${dias.length} dias de exercício: o máximo é ${dados.ajustes.ginasioMax}.`);
      return;
    }
  }

  dados[categoria.lista] = dados[categoria.lista].filter((dia) => dia !== texto);
  dados[categoria.falhados] = dados[categoria.falhados].filter((dia) => dia !== texto);
  if (estado === 'nada') dados[categoria.lista].push(texto);
  if (estado === 'feito') dados[categoria.falhados].push(texto);

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
      const estado = estadoDoDia(categoria, texto);
      const botao = botaoDiaLinha({
        texto, indice: i, descricao: `${categoria.titulo}, ${NOMES_ESTADOS[estado]}`, selecionado: texto === selecionado,
        rodape: criar('span', { className: 'dia-icone' }),
        aoTocar: () => mudarEstadoDia(categoria, texto),
      });
      // A cor e o ícone vêm do data-estado: o da categoria (feito), 'falhado' ou 'nada'.
      botao.dataset.estado = estado === 'feito' ? categoria.id : estado;
      return criar('li', {}, botao);
    })));
}

function desenharSemana() {
  const dias = diasDaSemanaMostrada();
  const { ginasioMin, ginasioMax } = dados.ajustes;
  const total = diasDeExercicio().length;
  const porCategoria = CATEGORIAS_EXERCICIO.map((c) => `${contarNaSemana(dados[c.lista])} ${c.resumo}`);
  const diasFalhados = CATEGORIAS_EXERCICIO.reduce((soma, c) => soma + contarNaSemana(dados[c.falhados]), 0);

  document.getElementById('semana-titulo').textContent =
    `${formatarData(dias[0], { day: 'numeric', month: 'short' })} a ${formatarData(dias[6], { day: 'numeric', month: 'short', year: 'numeric' })}`
      .replace(/\./g, '');

  const resumo = document.getElementById('semana-resumo');
  resumo.replaceChildren(
    `Exercício: ${total} de ${ginasioMin} mínimo · máximo ${ginasioMax}`,
    ' ',
    criar('span', { className: 'resumo-divisao', textContent: `${porCategoria.join(' · ')} · ${diasFalhados} ${diasFalhados === 1 ? 'falhado' : 'falhados'}` }),
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
