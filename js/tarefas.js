// tarefas.js: lista de Tarefas, na vista Semana. Coisas para fazer, sem hora e com dia opcional,
// que se marcam como feitas. Tocar no texto de uma tarefa abre a edição.

// Tarefa aberta para editar: { id, texto, dia }. Guarda o que já foi escrito, para não se perder se a lista for redesenhada.
let tarefaEmEdicao = null;

function dataPorExtenso(texto) {
  return primeiraMaiuscula(formatarData(textoParaData(texto), { weekday: 'long', day: 'numeric', month: 'long' }));
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
  }
  fecharEdicaoTarefa();
}

function linhaEdicaoTarefa() {
  const campoDia = criar('input', {
    id: 'tarefa-edicao-dia',
    type: 'date',
    value: tarefaEmEdicao.dia,
    oninput: (evento) => { tarefaEmEdicao.dia = evento.target.value; },
  });
  return criar('li', { className: 'linha linha-edicao' },
    criar('form', {
      className: 'formulario',
      onsubmit: (evento) => {
        evento.preventDefault();
        guardarEdicaoTarefa();
      },
    },
    criar('label', {}, 'Tarefa', criar('input', {
      id: 'tarefa-edicao-texto',
      type: 'text',
      value: tarefaEmEdicao.texto,
      required: true,
      oninput: (evento) => { tarefaEmEdicao.texto = evento.target.value; },
    })),
    criar('div', { className: 'campo-com-botao' },
      criar('label', {}, 'Dia (opcional)', campoDia),
      criar('button', {
        type: 'button',
        className: 'botao-pequeno',
        textContent: 'Sem dia',
        onclick: () => {
          campoDia.value = '';
          tarefaEmEdicao.dia = '';
        },
      })),
    criar('div', { className: 'botoes-edicao' },
      criar('button', { type: 'submit', className: 'botao-principal', textContent: 'Guardar' }),
      criar('button', { type: 'button', className: 'botao-secundario', textContent: 'Cancelar', onclick: fecharEdicaoTarefa }))));
}

function linhaTarefa(tarefa, mostrarDia) {
  if (tarefaEmEdicao && tarefaEmEdicao.id === tarefa.id) return linhaEdicaoTarefa();

  const conteudo = [tarefa.texto];
  if (mostrarDia) {
    const atrasada = !tarefa.feita && tarefa.dia < dataParaTexto(new Date());
    conteudo.push(criar('span', {
      className: atrasada ? 'tarefa-dia tarefa-atrasada' : 'tarefa-dia',
      textContent: dataPorExtenso(tarefa.dia),
    }));
  }
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
      'aria-label': `Editar: ${tarefa.texto}`,
      onclick: () => abrirEdicaoTarefa(tarefa),
    }, ...conteudo),
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

function grupoTarefas(titulo, tarefas, mostrarDia = false) {
  if (tarefas.length === 0) return [];
  const lista = criar('ul', { className: 'lista' }, ...tarefas.map((t) => linhaTarefa(t, mostrarDia)));
  return titulo ? [criar('h3', { textContent: titulo }), lista] : [lista];
}

function desenharTarefas() {
  const diasDaSemana = diasDaSemanaMostrada().map(dataParaTexto);
  const comDia = dados.tarefas.filter((t) => t.dia);
  const semDia = dados.tarefas.filter((t) => !t.dia);
  // De outras semanas só aparecem as por fazer, para nenhuma ficar esquecida.
  const noutrosDias = comDia
    .filter((t) => !t.feita && !diasDaSemana.includes(t.dia))
    .sort((a, b) => a.dia.localeCompare(b.dia));
  const temGrupos = comDia.length > 0;

  const caixa = document.getElementById('tarefas-lista');
  caixa.replaceChildren(
    ...diasDaSemana.flatMap((dia) => grupoTarefas(dataPorExtenso(dia), porFazerPrimeiro(comDia.filter((t) => t.dia === dia)))),
    ...grupoTarefas(temGrupos ? 'Sem dia' : null, porFazerPrimeiro(semDia)),
    ...grupoTarefas('Noutros dias', noutrosDias, true),
  );
  if (caixa.children.length === 0) {
    caixa.append(criar('p', { className: 'vazio', textContent: 'Sem tarefas.' }));
  }
}

document.getElementById('tarefas-formulario').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const campo = document.getElementById('tarefas-texto');
  const campoDia = document.getElementById('tarefas-dia');
  const texto = campo.value.trim();
  if (!texto) return;
  dados.tarefas.push({ id: novoId(), texto, feita: false, dia: campoDia.value || null });
  guardarDados();
  campo.value = '';
  campoDia.value = '';
  desenhar.semana();
});
