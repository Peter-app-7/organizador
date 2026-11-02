// agenda.js: vista Agenda. Compromissos com dia e hora.

function linhaCompromisso(compromisso) {
  return criar('li', { className: 'linha' },
    criar('span', { className: 'hora', textContent: compromisso.hora }),
    criar('span', { className: 'linha-texto', textContent: compromisso.texto }),
    botaoApagar(compromisso.texto, () => {
      dados.compromissos = dados.compromissos.filter((c) => c.id !== compromisso.id);
      guardarDados();
      desenharAgenda();
    }));
}

// Mostra os compromissos agrupados por dia, com o nome do dia por cima.
function gruposPorDia(compromissos) {
  const elementos = [];
  let diaAnterior = null;
  let lista = null;
  compromissos.forEach((compromisso) => {
    if (compromisso.data !== diaAnterior) {
      diaAnterior = compromisso.data;
      lista = criar('ul', { className: 'lista' });
      const nome = formatarData(textoParaData(compromisso.data), {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
      elementos.push(criar('h3', { textContent: nome }), lista);
    }
    lista.append(linhaCompromisso(compromisso));
  });
  return elementos;
}

function desenharAgenda() {
  const campoData = document.getElementById('agenda-data');
  if (!campoData.value) campoData.value = dataParaTexto(new Date());

  const agora = new Date();
  const momentoAgora = `${dataParaTexto(agora)} ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
  const momento = (c) => `${c.data} ${c.hora}`;
  const ordenados = [...dados.compromissos].sort((a, b) => momento(a).localeCompare(momento(b)));
  const proximos = ordenados.filter((c) => momento(c) >= momentoAgora);
  const passados = ordenados.filter((c) => momento(c) < momentoAgora).reverse();

  const caixa = document.getElementById('agenda-lista');
  caixa.replaceChildren(...gruposPorDia(proximos));
  if (proximos.length === 0) {
    caixa.append(criar('p', { className: 'vazio', textContent: 'Sem compromissos marcados.' }));
  }
  if (passados.length > 0) {
    caixa.append(criar('details', {},
      criar('summary', { textContent: `Compromissos passados (${passados.length})` }),
      ...gruposPorDia(passados)));
  }
}

document.getElementById('agenda-formulario').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const campoTexto = document.getElementById('agenda-texto');
  const campoHora = document.getElementById('agenda-hora');
  const texto = campoTexto.value.trim();
  if (!texto) return;
  dados.compromissos.push({
    id: novoId(),
    texto,
    data: document.getElementById('agenda-data').value,
    hora: campoHora.value,
  });
  guardarDados();
  campoTexto.value = '';
  campoHora.value = '';
  desenharAgenda();
});

desenhar.agenda = desenharAgenda;
