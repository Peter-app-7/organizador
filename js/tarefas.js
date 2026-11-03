// tarefas.js: lista de Tarefas, na vista Semana. Coisas para fazer, sem hora e com dia opcional,
// que se marcam como feitas. Tocar no texto de uma tarefa abre a edição.
// Mostra as tarefas sem dia e só as marcadas para o dia selecionado.

// Tarefa aberta para editar: { id, texto, dia }. Guarda o que já foi escrito, para não se perder se a lista for redesenhada.
let tarefaEmEdicao = null;

function dataPorExtenso(texto) {
  return primeiraMaiuscula(formatarData(textoParaData(texto), { weekday: 'long', day: 'numeric', month: 'long' }));
}

const MESES_ABREVIADOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Ex.: "2026-11-12" passa a "12 nov".
function dataAbreviada(texto) {
  const data = textoParaData(texto);
  return `${data.getDate()} ${MESES_ABREVIADOS[data.getMonth()]}`;
}

// Ícone de calendário que abre o seletor de data do sistema e, com dia escolhido, mostra a data e um ✕.
// O campo de data fica invisível por cima do ícone: é tocar nele que abre o seletor no iPhone.
function seletorDia(id, valor, aoMudar) {
  const campo = criar('input', {
    id,
    type: 'date',
    className: 'seletor-dia-campo',
    value: valor,
    'aria-label': 'Dia da tarefa (opcional)',
  });
  const rotulo = criar('span', { className: 'seletor-dia-rotulo' });
  const botao = criar('label', { className: 'seletor-dia' }, rotulo, campo);
  const remover = criar('button', {
    type: 'button',
    className: 'botao-apagar',
    textContent: '✕',
    'aria-label': 'Retirar o dia',
  });

  const mostrar = () => {
    rotulo.textContent = campo.value ? dataAbreviada(campo.value) : '';
    botao.classList.toggle('seletor-dia-escolhido', Boolean(campo.value));
    remover.hidden = !campo.value;
  };
  const mudou = () => {
    mostrar();
    aoMudar(campo.value);
  };
  campo.addEventListener('input', mudou);
  campo.addEventListener('change', mudou);
  remover.addEventListener('click', () => {
    campo.value = '';
    mudou();
  });
  mostrar();
  return [botao, remover];
}

function desenharSeletorNovaTarefa() {
  document.getElementById('tarefas-seletor-dia').replaceChildren(...seletorDia('tarefas-dia', '', () => {}));
}

// Uma tarefa guardada para outro dia deixa de se ver aqui: o aviso diz onde ficou.
function avisarSeFicouNoutroDia(dia) {
  if (dia && dia !== dataParaTexto(diaSelecionado)) avisar(`Tarefa guardada em: ${dataPorExtenso(dia)}.`);
}

function abrirEdicaoTarefa(tarefa) {
  tarefaEmEdicao = { id: tarefa.id, texto: tarefa.texto, dia: tarefa.dia || '' };
  desenhar.semana();
  // Sem esperar: o iPhone só mostra o teclado se o campo receber o foco durante o próprio toque.
  document.getElementById('tarefa-edicao-texto').focus();
}

function fecharEdicaoTarefa() {
  tarefaEmEdicao = null;
  desenhar.semana();
}

function guardarEdicaoTarefa() {
  const texto = tarefaEmEdicao.texto.trim();
  if (!texto) {
    avisar('Escreve o texto da tarefa.');
    return;
  }
  const tarefa = dados.tarefas.find((t) => t.id === tarefaEmEdicao.id);
  if (tarefa) {
    tarefa.texto = texto;
    tarefa.dia = tarefaEmEdicao.dia || null;
    guardarDados();
    avisarSeFicouNoutroDia(tarefa.dia);
  }
  fecharEdicaoTarefa();
}

function linhaEdicaoTarefa() {
  return criar('li', { className: 'linha linha-edicao' },
    criar('form', {
      className: 'formulario',
      onsubmit: (evento) => {
        evento.preventDefault();
        guardarEdicaoTarefa();
      },
    },
    criar('div', { className: 'linha-tarefa-campos' },
      criar('input', {
        id: 'tarefa-edicao-texto',
        type: 'text',
        value: tarefaEmEdicao.texto,
        required: true,
        'aria-label': 'Texto da tarefa',
        oninput: (evento) => { tarefaEmEdicao.texto = evento.target.value; },
      }),
      criar('div', { className: 'seletor-dia-caixa' }, ...seletorDia('tarefa-edicao-dia', tarefaEmEdicao.dia, (dia) => { tarefaEmEdicao.dia = dia; }))),
    criar('div', { className: 'botoes-edicao' },
      criar('button', { type: 'submit', className: 'botao-principal', textContent: 'Guardar' }),
      criar('button', { type: 'button', className: 'botao-secundario', textContent: 'Cancelar', onclick: fecharEdicaoTarefa }))));
}

function linhaTarefa(tarefa) {
  if (tarefaEmEdicao && tarefaEmEdicao.id === tarefa.id) return linhaEdicaoTarefa();

  return criar('li', { className: tarefa.feita ? 'linha linha-feita' : 'linha' },
    criar('input', {
      type: 'checkbox',
      checked: tarefa.feita,
      'aria-label': `Marcar como feita: ${tarefa.texto}`,
      onchange: () => {
        tarefa.feita = !tarefa.feita;
        guardarDados();
        desenhar.semana();
      },
    }),
    criar('button', {
      type: 'button',
      className: 'linha-texto tarefa-texto',
      textContent: tarefa.texto,
      'aria-label': `Editar: ${tarefa.texto}`,
      onclick: () => abrirEdicaoTarefa(tarefa),
    }),
    botaoApagar(tarefa.texto, () => {
      dados.tarefas = dados.tarefas.filter((t) => t.id !== tarefa.id);
      if (tarefaEmEdicao && tarefaEmEdicao.id === tarefa.id) tarefaEmEdicao = null;
      guardarDados();
      desenhar.semana();
    }));
}

// As tarefas por fazer aparecem primeiro; as feitas ficam no fim.
function porFazerPrimeiro(tarefas) {
  return [...tarefas.filter((t) => !t.feita), ...tarefas.filter((t) => t.feita)];
}

function grupoTarefas(titulo, tarefas) {
  if (tarefas.length === 0) return [];
  const lista = criar('ul', { className: 'lista' }, ...tarefas.map(linhaTarefa));
  return titulo ? [criar('h3', { textContent: titulo }), lista] : [lista];
}

function desenharTarefas() {
  const selecionado = dataParaTexto(diaSelecionado);
  document.getElementById('tarefas-dia-selecionado').textContent = dataPorExtenso(selecionado);

  // Uma tarefa aberta para editar continua à vista, mesmo que se navegue para outro dia.
  const emEdicao = (t) => tarefaEmEdicao && tarefaEmEdicao.id === t.id;
  const doDia = dados.tarefas.filter((t) => t.dia && (t.dia === selecionado || emEdicao(t)));
  const semDia = dados.tarefas.filter((t) => !t.dia);

  const caixa = document.getElementById('tarefas-lista');
  caixa.replaceChildren(
    ...grupoTarefas(doDia.length > 0 ? 'Para este dia' : null, porFazerPrimeiro(doDia)),
    ...grupoTarefas(doDia.length > 0 ? 'Sem dia' : null, porFazerPrimeiro(semDia)),
  );
  if (caixa.children.length === 0) {
    caixa.append(criar('p', { className: 'vazio', textContent: 'Sem tarefas.' }));
  }
}

document.getElementById('tarefas-formulario').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const campo = document.getElementById('tarefas-texto');
  const dia = document.getElementById('tarefas-dia').value;
  const texto = campo.value.trim();
  if (!texto) return;
  dados.tarefas.push({ id: novoId(), texto, feita: false, dia: dia || null });
  guardarDados();
  avisarSeFicouNoutroDia(dia);
  campo.value = '';
  desenharSeletorNovaTarefa();
  desenhar.semana();
});

desenharSeletorNovaTarefa();
