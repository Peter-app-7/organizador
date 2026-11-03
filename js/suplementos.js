// suplementos.js: vista Suplementos. Lista diária, por momento do dia, e a água de hoje por baixo.
// Os nomes são escritos na app e ficam só nos dados guardados no aparelho.

// Momentos escolhidos para o novo suplemento, antes de o adicionar.
const novosMomentos = new Set();
const NIVEIS_AGUA = [0.5, 1, 1.5, 2];

// As marcas são guardadas com a data: noutro dia já não contam, por isso limpam-se sozinhas.
function marcadosDeHoje() {
  return dados.tomados.data === dataParaTexto(new Date()) ? dados.tomados.marcados : [];
}

function chaveTomado(suplemento, momento) {
  return `${suplemento.id}|${momento}`;
}

function alternarTomado(chave) {
  const marcados = marcadosDeHoje();
  dados.tomados = {
    data: dataParaTexto(new Date()),
    marcados: marcados.includes(chave) ? marcados.filter((c) => c !== chave) : [...marcados, chave],
  };
  guardarDados();
  desenharSuplementos();
}

// Tira as marcas de um suplemento (ou só de um momento), para não voltarem se for adicionado de novo.
function limparMarcas(suplemento, momento) {
  const prefixo = momento ? chaveTomado(suplemento, momento) : `${suplemento.id}|`;
  dados.tomados.marcados = dados.tomados.marcados.filter((c) => !c.startsWith(prefixo));
}

function alternarMomento(suplemento, momento) {
  if (suplemento.momentos.includes(momento)) {
    if (suplemento.momentos.length === 1) {
      avisar('Cada suplemento precisa de pelo menos um momento.');
      return;
    }
    suplemento.momentos = suplemento.momentos.filter((m) => m !== momento);
    limparMarcas(suplemento, momento);
  } else {
    // Horário livre e horários fixos não se juntam: escolher um tira o outro.
    const ficam = momento === 'livre' ? [] : suplemento.momentos.filter((m) => m !== 'livre');
    suplemento.momentos
      .filter((m) => !ficam.includes(m))
      .forEach((m) => limparMarcas(suplemento, m));
    suplemento.momentos = [...ficam, momento];
  }
  guardarDados();
  desenharSuplementos();
}

// Um nome na lista do dia: tocar marca ou desmarca como tomado.
function nomeTomado(suplemento, momento, marcados) {
  const chave = chaveTomado(suplemento, momento);
  const tomado = marcados.includes(chave);
  const botao = criar('button', {
    type: 'button',
    className: 'suplemento',
    'aria-pressed': String(tomado),
    onclick: () => alternarTomado(chave),
  });
  if (tomado) botao.append(criar('span', { textContent: '✓ ', 'aria-hidden': 'true' }));
  botao.append(suplemento.nome);
  return criar('li', {}, botao);
}

// Quadrados M, A, J, N e L, usados ao adicionar e em cada linha da tabela.
function quadradosMomentos(estaAtivo, aoTocar, descricao) {
  return criar('div', { className: 'quadrados-momentos' }, ...MOMENTOS.map((momento) => criar('button', {
    type: 'button',
    className: 'quadrado-momento',
    textContent: momento.letra,
    'aria-pressed': String(estaAtivo(momento.id)),
    'aria-label': `${descricao}: ${momento.nome}`,
    onclick: () => aoTocar(momento.id),
  })));
}

function linhaTabela(suplemento) {
  return criar('li', { className: 'linha-tabela' },
    criar('span', { className: 'nome-tabela', textContent: suplemento.nome }),
    quadradosMomentos(
      (momento) => suplemento.momentos.includes(momento),
      (momento) => alternarMomento(suplemento, momento),
      suplemento.nome,
    ),
    botaoApagar(suplemento.nome, () => {
      limparMarcas(suplemento);
      dados.suplementos = dados.suplementos.filter((s) => s.id !== suplemento.id);
      guardarDados();
      desenharSuplementos();
    }));
}

function desenharNovosMomentos() {
  document.getElementById('suplementos-novos-momentos').replaceChildren(quadradosMomentos(
    (momento) => novosMomentos.has(momento),
    (momento) => {
      if (novosMomentos.has(momento)) {
        novosMomentos.delete(momento);
      } else {
        // Horário livre e horários fixos não se juntam: escolher um tira o outro.
        if (momento === 'livre') novosMomentos.clear();
        else novosMomentos.delete('livre');
        novosMomentos.add(momento);
      }
      desenharNovosMomentos();
    },
    'Novo suplemento',
  ));
}

function desenharSuplementos() {
  const marcados = marcadosDeHoje();
  const ordenados = [...dados.suplementos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-PT'));
  const caixa = document.getElementById('suplementos-momentos');
  caixa.replaceChildren();

  const doMomento = (id) => ordenados.filter((s) => s.momentos.includes(id));
  const nomes = (id) => criar('ul', { className: 'suplementos-nomes' }, ...doMomento(id).map((s) => nomeTomado(s, id, marcados)));

  if (ordenados.some((s) => s.momentos.length > 0)) {
    // Dois a dois, sempre nos mesmos lugares: um horário vazio mostra só o título e um traço.
    caixa.append(criar('div', { className: 'momentos-grelha' }, ...MOMENTOS.filter((m) => m.id !== 'livre').map((momento) => (
      criar('div', { className: 'momento-celula' },
        criar('h3', { className: 'momento-titulo', textContent: momento.nome }),
        doMomento(momento.id).length > 0 ? nomes(momento.id) : criar('p', { className: 'momento-vazio', textContent: '—' }))
    ))));
    const livre = MOMENTOS.find((m) => m.id === 'livre');
    if (doMomento(livre.id).length > 0) {
      caixa.append(criar('div', { className: 'momento-livre' },
        criar('h3', { className: 'momento-titulo', textContent: livre.nome }),
        nomes(livre.id)));
    }
  } else {
    caixa.append(criar('p', { className: 'vazio', textContent: 'Ainda não há suplementos. Toca em "Editar" para os adicionar.' }));
  }

  desenharNovosMomentos();
  document.getElementById('suplementos-lista').replaceChildren(...ordenados.map(linhaTabela));
  desenharAgua();
}

document.getElementById('suplementos-editar').addEventListener('click', (evento) => {
  const painel = document.getElementById('suplementos-gerir');
  painel.hidden = !painel.hidden;
  evento.currentTarget.textContent = painel.hidden ? 'Editar' : 'Fechar';
  evento.currentTarget.setAttribute('aria-expanded', String(!painel.hidden));
  // A editar, a vista cresce e a página faz scroll normalmente.
  document.getElementById('vista-suplementos').classList.toggle('suplementos-a-editar', !painel.hidden);
});

document.getElementById('suplementos-formulario').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const campo = document.getElementById('suplementos-nome');
  const nome = campo.value.trim();
  if (!nome) return;
  if (dados.suplementos.some((s) => chaveTexto(s.nome) === chaveTexto(nome))) {
    avisar('Este suplemento já está na lista.');
    return;
  }
  if (novosMomentos.size === 0) {
    avisar('Toca em M, A, J, N ou L para escolher pelo menos um momento.');
    return;
  }
  dados.suplementos.push({
    id: novoId(),
    nome,
    momentos: MOMENTOS.map((m) => m.id).filter((id) => novosMomentos.has(id)),
  });
  guardarDados();
  campo.value = '';
  novosMomentos.clear();
  desenharSuplementos();
});

// A água é guardada por data: aqui mexe-se sempre na de hoje, e a Semana mostra a de cada dia.
function aguaDoDia(texto) {
  return dados.agua[texto] || 0;
}

function rotuloAgua(litros) {
  return `${String(litros).replace('.', ',')} L`;
}

// Tocar num nível marca o total até esse valor; tocar no nível já marcado volta ao anterior.
function tocarNivelAgua(litros) {
  const hoje = dataParaTexto(new Date());
  const novo = aguaDoDia(hoje) === litros ? litros - 0.5 : litros;
  if (novo > 0) dados.agua[hoje] = novo;
  else delete dados.agua[hoje];
  guardarDados();
  desenharAgua();
}

function desenharAgua() {
  const atual = aguaDoDia(dataParaTexto(new Date()));
  document.getElementById('agua-niveis').replaceChildren(...NIVEIS_AGUA.map((litros) => criar('button', {
    type: 'button',
    className: 'agua-nivel',
    textContent: rotuloAgua(litros),
    'aria-pressed': String(litros <= atual),
    onclick: () => tocarNivelAgua(litros),
  })));
}

// Altura que sobra entre o cabeçalho do tempo e a barra de baixo. A vista ocupa exatamente esse espaço:
// o Jejum e a Água ficam sempre visíveis e, se faltar espaço, só os horários fazem scroll.
const ALTURA_MINIMA_SUPLEMENTOS = 360; // em ecrãs mais baixos, como na horizontal, a página faz scroll
const cabecalhoTempo = document.querySelector('.tempo');
const barraNavegacao = document.querySelector('.navegacao');

function ajustarAlturaSuplementos() {
  const livre = window.innerHeight - cabecalhoTempo.offsetHeight - barraNavegacao.offsetHeight - 12; // 8 em cima e 4 em baixo
  document.documentElement.style.setProperty('--altura-suplementos', `${Math.max(livre, ALTURA_MINIMA_SUPLEMENTOS)}px`);
}
window.addEventListener('resize', ajustarAlturaSuplementos);
// O cabeçalho muda de altura quando a previsão chega.
new ResizeObserver(ajustarAlturaSuplementos).observe(cabecalhoTempo);
ajustarAlturaSuplementos();

desenhar.suplementos = desenharSuplementos;
