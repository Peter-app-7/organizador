// suplementos.js: vista Suplementos. Lista diária, por momento do dia, e a água de hoje por baixo.
// Os nomes são escritos na app e ficam só nos dados guardados no aparelho.

// Momentos escolhidos para o novo suplemento, antes de o adicionar.
const novosMomentos = new Set();
const NIVEIS_AGUA = [
  { litros: 0.5, rotulo: '0,5 L' },
  { litros: 1, rotulo: '1 L' },
  { litros: 1.5, rotulo: '1,5 L' },
  { litros: 2, rotulo: '2 L' },
];

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
    suplemento.momentos.push(momento);
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

// Quadrados M, A, J e N, usados ao adicionar e em cada linha da tabela.
function quadradosMomentos(estaAtivo, aoTocar, descricao) {
  return criar('div', { className: 'quadrados-momentos' }, ...MOMENTOS.map((momento) => criar('button', {
    type: 'button',
    className: 'quadrado-momento',
    textContent: momento.nome[0],
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
      if (novosMomentos.has(momento)) novosMomentos.delete(momento);
      else novosMomentos.add(momento);
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

  MOMENTOS.forEach((momento) => {
    const doMomento = ordenados.filter((s) => s.momentos.includes(momento.id));
    if (doMomento.length === 0) return;
    caixa.append(
      criar('h3', { className: 'momento-titulo', textContent: momento.nome }),
      criar('ul', { className: 'suplementos-nomes' }, ...doMomento.map((s) => nomeTomado(s, momento.id, marcados))),
    );
  });
  if (caixa.children.length === 0) {
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
    avisar('Toca em M, A, J ou N para escolher pelo menos um momento.');
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

// A água é guardada com a data: noutro dia já não conta, por isso volta sozinha a zero.
function aguaDeHoje() {
  return dados.agua.data === dataParaTexto(new Date()) ? dados.agua.litros : 0;
}

// Tocar num nível marca o total até esse valor; tocar no nível já marcado volta ao anterior.
function tocarNivelAgua(litros) {
  dados.agua = {
    data: dataParaTexto(new Date()),
    litros: aguaDeHoje() === litros ? litros - 0.5 : litros,
  };
  guardarDados();
  desenharAgua();
}

function desenharAgua() {
  const atual = aguaDeHoje();
  document.getElementById('agua-niveis').replaceChildren(...NIVEIS_AGUA.map((nivel) => criar('button', {
    type: 'button',
    className: 'agua-nivel',
    textContent: nivel.rotulo,
    'aria-pressed': String(nivel.litros <= atual),
    onclick: () => tocarNivelAgua(nivel.litros),
  })));
}

desenhar.suplementos = desenharSuplementos;
