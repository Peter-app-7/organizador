// suplementos.js: lista diária de suplementos, na vista inicial, por momento do dia.
// Os nomes são escritos na app e ficam só nos dados guardados no aparelho.

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
      desenharSuplementos();
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

function linhaTomado(suplemento, momento, marcados) {
  const chave = chaveTomado(suplemento, momento);
  const tomado = marcados.includes(chave);
  return criar('li', {},
    criar('label', { className: tomado ? 'linha linha-feita' : 'linha' },
      criar('input', { type: 'checkbox', checked: tomado, onchange: () => alternarTomado(chave) }),
      criar('span', { className: 'linha-texto', textContent: suplemento.nome })));
}

// Caixa e nome de um momento, usados ao adicionar e ao gerir um suplemento.
function escolhaMomento(momento, marcado, aoMudar) {
  return criar('label', { className: 'momento-escolha' },
    criar('input', { type: 'checkbox', checked: marcado, value: momento.id, onchange: aoMudar }),
    criar('span', { textContent: momento.nome }));
}

function linhaGerir(suplemento) {
  return criar('li', { className: 'linha linha-suplemento' },
    criar('span', { className: 'linha-texto', textContent: suplemento.nome }),
    botaoApagar(suplemento.nome, () => {
      limparMarcas(suplemento);
      dados.suplementos = dados.suplementos.filter((s) => s.id !== suplemento.id);
      guardarDados();
      desenharSuplementos();
    }),
    criar('div', { className: 'momentos-escolha' }, ...MOMENTOS.map((momento) => escolhaMomento(
      momento,
      suplemento.momentos.includes(momento.id),
      () => alternarMomento(suplemento, momento.id),
    ))));
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
      criar('h3', { textContent: momento.nome }),
      criar('ul', { className: 'lista' }, ...doMomento.map((s) => linhaTomado(s, momento.id, marcados))),
    );
  });
  if (caixa.children.length === 0) {
    caixa.append(criar('p', { className: 'vazio', textContent: 'Ainda não há suplementos. Adiciona-os em "Gerir suplementos".' }));
  }

  document.getElementById('suplementos-lista').replaceChildren(...ordenados.map(linhaGerir));
}

// Prepara as caixas dos momentos no formulário de adicionar.
const novosMomentos = document.getElementById('suplementos-novos-momentos');
novosMomentos.append(...MOMENTOS.map((momento) => escolhaMomento(momento, false)));

document.getElementById('suplementos-formulario').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const campo = document.getElementById('suplementos-nome');
  const nome = campo.value.trim();
  const caixas = [...novosMomentos.querySelectorAll('input')];
  const momentos = caixas.filter((c) => c.checked).map((c) => c.value);
  if (!nome) return;
  if (dados.suplementos.some((s) => s.nome.toLocaleLowerCase('pt-PT') === nome.toLocaleLowerCase('pt-PT'))) {
    avisar('Este suplemento já está na lista.');
    return;
  }
  if (momentos.length === 0) {
    avisar('Escolhe pelo menos um momento do dia.');
    return;
  }
  dados.suplementos.push({ id: novoId(), nome, momentos });
  guardarDados();
  campo.value = '';
  caixas.forEach((c) => { c.checked = false; });
  desenharSuplementos();
});
