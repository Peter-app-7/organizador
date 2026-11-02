// tarefas.js: lista de Tarefas, na vista Semana. Coisas para fazer, sem hora, que se marcam como feitas.

function linhaTarefa(tarefa) {
  return criar('li', { className: tarefa.feita ? 'linha linha-feita' : 'linha' },
    criar('input', {
      type: 'checkbox',
      checked: tarefa.feita,
      'aria-label': `Marcar como feita: ${tarefa.texto}`,
      onchange: () => {
        tarefa.feita = !tarefa.feita;
        guardarDados();
        desenharTarefas();
      },
    }),
    criar('span', { className: 'linha-texto', textContent: tarefa.texto }),
    botaoApagar(tarefa.texto, () => {
      dados.tarefas = dados.tarefas.filter((t) => t.id !== tarefa.id);
      guardarDados();
      desenharTarefas();
    }));
}

function desenharTarefas() {
  const lista = document.getElementById('tarefas-lista');
  // As tarefas por fazer aparecem primeiro; as feitas ficam no fim.
  const ordenadas = [
    ...dados.tarefas.filter((t) => !t.feita),
    ...dados.tarefas.filter((t) => t.feita),
  ];
  lista.replaceChildren(...ordenadas.map(linhaTarefa));
  if (ordenadas.length === 0) {
    lista.append(criar('li', { className: 'vazio', textContent: 'Sem tarefas.' }));
  }
}

document.getElementById('tarefas-formulario').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const campo = document.getElementById('tarefas-texto');
  const texto = campo.value.trim();
  if (!texto) return;
  dados.tarefas.push({ id: novoId(), texto, feita: false });
  guardarDados();
  campo.value = '';
  desenharTarefas();
});
