// despesas.js: secção Despesas mensais da vista Gastos. Gastos gerais, por categoria, com as categorias editáveis.
// Os gastos gerais e as categorias ficam em chaves próprias. Os registos de "Registar compras" (gastos.js) continuam
// na chave deles e aparecem aqui na categoria Supermercado, sem serem alterados.

const CHAVE_DESPESAS = 'organizador-despesas';
const CHAVE_CATEGORIAS_DESPESAS = 'organizador-categorias-despesas';
const NOTA_MAXIMA = 120; // letras

// Supermercado e Outros têm id fixo: os registos de compras vão para o primeiro e os de categorias apagadas para o segundo.
const CATEGORIAS_DESPESAS_INICIAIS = [
  { id: 'supermercado', nome: 'Supermercado' },
  { id: 'combustivel', nome: 'Combustível' },
  { id: 'restauracao', nome: 'Restauração e lazer' },
  { id: 'bebe', nome: 'Produtos bebé' },
  { id: 'saude', nome: 'Saúde' },
  { id: 'outros', nome: 'Outros' },
];
const CATEGORIAS_FIXAS = ['supermercado', 'outros'];

// Lista limpa: ids e nomes únicos (sem contar maiúsculas e acentos), Supermercado e Outros sempre presentes, Outros no fim.
// Lança um erro se não for uma lista.
function normalizarCategoriasDespesas(lista) {
  if (!Array.isArray(lista)) throw new Error('Formato desconhecido');
  const ids = new Set();
  const nomes = new Set();
  const limpas = [];
  lista.forEach((c) => {
    if (!c || typeof c.id !== 'string' || !c.id || typeof c.nome !== 'string') return;
    const nome = primeiraMaiuscula(c.nome.replace(/\s+/g, ' ')).slice(0, 40);
    if (!nome || ids.has(c.id) || nomes.has(chaveTexto(nome))) return;
    ids.add(c.id);
    nomes.add(chaveTexto(nome));
    limpas.push({ id: c.id, nome });
  });
  CATEGORIAS_FIXAS.forEach((id) => {
    if (ids.has(id)) return;
    const inicial = CATEGORIAS_DESPESAS_INICIAIS.find((c) => c.id === id);
    // Se o nome já estiver a ser usado por outra, fica com "(2)" para não se repetir.
    const nome = nomes.has(chaveTexto(inicial.nome)) ? `${inicial.nome} (2)` : inicial.nome;
    if (id === 'supermercado') limpas.unshift({ id, nome });
    else limpas.push({ id, nome });
    ids.add(id);
    nomes.add(chaveTexto(nome));
  });
  const outros = limpas.find((c) => c.id === 'outros');
  return [...limpas.filter((c) => c.id !== 'outros'), outros];
}

// Gastos vindos de fora (do aparelho ou de uma cópia): os incompletos ficam de fora, e uma categoria que
// já não exista passa para Outros. Lança um erro se não for uma lista.
function normalizarDespesas(lista, categorias) {
  if (!Array.isArray(lista)) throw new Error('Formato desconhecido');
  const idsCategorias = new Set(categorias.map((c) => c.id));
  const ids = new Set();
  return lista
    .filter((d) => d && typeof d === 'object'
      && typeof d.data === 'string' && dataValida(d.data)
      && Number.isInteger(d.centimos) && d.centimos > 0 && d.centimos <= VALOR_MAXIMO)
    .map((d) => {
      const id = typeof d.id === 'string' && d.id && !ids.has(d.id) ? d.id : novoId();
      ids.add(id);
      return {
        id,
        data: d.data,
        categoria: idsCategorias.has(d.categoria) ? d.categoria : 'outros',
        centimos: d.centimos,
        nota: typeof d.nota === 'string' ? d.nota.replace(/\s+/g, ' ').trim().slice(0, NOTA_MAXIMA) : '',
      };
    });
}

// Lê uma chave { versao, <campo>: [...] }; se estiver ilegível, guarda o original à parte e devolve null.
function lerChave(chave, campo) {
  let texto = null;
  try {
    texto = localStorage.getItem(chave);
    if (!texto) return null;
    const lista = JSON.parse(texto)[campo];
    if (!Array.isArray(lista)) throw new Error('Formato desconhecido');
    return lista;
  } catch (erro) {
    try {
      if (texto) localStorage.setItem(chave + '-danificados', texto);
    } catch (erroAoGuardar) { /* sem espaço ou sem acesso */ }
    return null;
  }
}

let categoriasDespesas = normalizarCategoriasDespesas(lerChave(CHAVE_CATEGORIAS_DESPESAS, 'categorias') || CATEGORIAS_DESPESAS_INICIAIS);
let despesas = normalizarDespesas(lerChave(CHAVE_DESPESAS, 'registos') || [], categoriasDespesas);

function guardarChave(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch (erro) {
    avisar('Não foi possível guardar. Exporta uma cópia de segurança.');
    return false;
  }
}

function guardarDespesas() {
  return guardarChave(CHAVE_DESPESAS, { versao: 1, registos: despesas });
}

function guardarCategoriasDespesas() {
  return guardarChave(CHAVE_CATEGORIAS_DESPESAS, { versao: 1, categorias: categoriasDespesas });
}

function nomeCategoriaDespesa(id) {
  const categoria = categoriasDespesas.find((c) => c.id === id);
  return categoria ? categoria.nome : 'Outros';
}

// Todos os gastos num só formato: os gerais e os de "Registar compras" (em Supermercado, com a loja como nota).
function todosOsGastos() {
  return [
    ...despesas.map((d) => ({ origem: 'despesa', id: d.id, data: d.data, categoria: d.categoria, nota: d.nota, centimos: d.centimos, registo: d })),
    ...gastos.map((g) => ({ origem: 'compras', id: g.id, data: g.data, categoria: 'supermercado', nota: g.loja, centimos: g.centimos, registo: g })),
  ];
}

function somaCentimos(lista) {
  return lista.reduce((soma, g) => soma + g.centimos, 0);
}

// --- Formulário de um gasto geral: data, categoria, valor e nota opcional ---
function formularioDespesa({ registo, aoGuardar, aoCancelar, aoApagar }) {
  const n = ++contadorFormularios; // partilhado com gastos.js, para os ids nunca se repetirem
  const campo = (id, etiqueta, entrada) => {
    entrada.id = `despesa-${id}-${n}`;
    entrada.setAttribute('aria-describedby', `despesa-${id}-${n}-erro`);
    const erro = criar('p', { id: `despesa-${id}-${n}-erro`, className: 'erro-campo', hidden: true });
    return { entrada, erro, rotulo: criar('label', { htmlFor: entrada.id }, etiqueta, entrada, erro) };
  };
  const data = campo('data', 'Data', criar('input', { type: 'date', value: registo ? registo.data : dataParaTexto(new Date()), required: true }));
  const categoria = campo('categoria', 'Categoria', criar('select', {},
    ...categoriasDespesas.map((c) => criar('option', { value: c.id, textContent: c.nome }))));
  categoria.entrada.value = registo ? registo.categoria : categoriasDespesas[0].id;
  const valor = campo('valor', 'Valor total (€)', criar('input', {
    type: 'text', value: registo ? valorParaCampo(registo.centimos) : '', placeholder: '0,00', inputMode: 'decimal', autocomplete: 'off', enterKeyHint: 'next',
  }));
  const nota = campo('nota', 'Nota (opcional)', criar('input', {
    type: 'text', value: registo ? registo.nota : '', placeholder: 'Ex.: farmácia', autocomplete: 'off', autocapitalize: 'sentences', enterKeyHint: 'done', maxLength: NOTA_MAXIMA,
  }));
  const guardar = criar('button', { type: 'submit', className: 'botao-principal', textContent: registo ? 'Guardar alterações' : 'Guardar' });
  const botoes = [guardar, criar('button', { type: 'button', className: 'botao-secundario', textContent: 'Cancelar', onclick: aoCancelar })];
  if (aoApagar) botoes.push(criar('button', { type: 'button', className: 'botao-apagar-registo', textContent: 'Apagar gasto', onclick: aoApagar }));

  const mostrarErro = (parte, mensagem) => {
    parte.erro.textContent = mensagem || '';
    parte.erro.hidden = !mensagem;
    if (mensagem) parte.entrada.setAttribute('aria-invalid', 'true');
    else parte.entrada.removeAttribute('aria-invalid');
  };

  const formulario = criar('form', { className: 'formulario formulario-gasto', noValidate: true },
    data.rotulo, categoria.rotulo, valor.rotulo, nota.rotulo, ...botoes);
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const lido = lerValor(valor.entrada.value);
    const existe = categoriasDespesas.some((c) => c.id === categoria.entrada.value);
    const erros = [
      [data, dataValida(data.entrada.value) ? null : 'Escolhe uma data válida.'],
      [categoria, existe ? null : 'Escolhe uma categoria.'],
      [valor, lido.erro || null],
    ];
    erros.forEach(([parte, mensagem]) => mostrarErro(parte, mensagem));
    const primeiro = erros.find(([, mensagem]) => mensagem);
    if (primeiro) {
      primeiro[0].entrada.focus();
      return;
    }
    aoGuardar({
      data: data.entrada.value,
      categoria: categoria.entrada.value,
      centimos: lido.centimos,
      nota: nota.entrada.value.replace(/\s+/g, ' ').trim().slice(0, NOTA_MAXIMA),
    });
  });
  [data, categoria, valor, nota].forEach((parte) => {
    parte.entrada.addEventListener('input', () => mostrarErro(parte, null));
  });
  // "Seguinte" no teclado do valor passa para a nota, em vez de guardar logo.
  valor.entrada.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter') return;
    evento.preventDefault();
    nota.entrada.focus();
  });
  formulario.addEventListener('focusin', () => setTimeout(() => manterVisivel(guardar), 350));
  return formulario;
}

// --- Secção "Gastos" ---
let despesaAEditar = null; // "despesa:id" ou "compras:id" do gasto aberto para editar
const caixaNovaDespesa = document.getElementById('despesas-registo');
const botaoNovaDespesa = document.getElementById('despesas-registar');

function fecharNovaDespesa() {
  caixaNovaDespesa.replaceChildren();
  caixaNovaDespesa.hidden = true;
  botaoNovaDespesa.setAttribute('aria-expanded', 'false');
}

function abrirNovaDespesa() {
  if (despesaAEditar) {
    despesaAEditar = null;
    desenharDespesasMes(inicioDoMes(mesDeslocamento));
  }
  caixaNovaDespesa.replaceChildren(
    criar('h3', { className: 'despesas-registo-titulo', textContent: 'Registar gasto' }),
    formularioDespesa({
      aoGuardar: (novo) => {
        despesas.push({ id: novoId(), ...novo });
        if (!guardarDespesas()) {
          despesas.pop();
          return;
        }
        fecharNovaDespesa();
        // Leva o seletor para o mês do gasto, para se ver logo na lista.
        const [ano, mes] = novo.data.split('-').map(Number);
        const hoje = new Date();
        mesDeslocamento = (ano - hoje.getFullYear()) * 12 + (mes - 1 - hoje.getMonth());
        desenharMes();
        avisar(`Registado: ${formatarEuros(novo.centimos)} em ${nomeCategoriaDespesa(novo.categoria)}.`);
      },
      aoCancelar: fecharNovaDespesa,
    }),
  );
  caixaNovaDespesa.hidden = false;
  botaoNovaDespesa.setAttribute('aria-expanded', 'true');
}

botaoNovaDespesa.addEventListener('click', () => {
  if (caixaNovaDespesa.hidden) abrirNovaDespesa();
  else fecharNovaDespesa();
});

// Grava uma alteração; se não der para guardar, desfaz e devolve false.
function alterarRegisto(item, alterado) {
  const antigo = { ...item.registo };
  Object.assign(item.registo, alterado);
  const guardou = item.origem === 'compras' ? guardarGastos() : guardarDespesas();
  if (!guardou) Object.assign(item.registo, antigo);
  return guardou;
}

function apagarRegisto(item) {
  if (item.origem === 'compras') {
    const antes = gastos;
    gastos = gastos.filter((g) => g.id !== item.id);
    if (guardarGastos()) return true;
    gastos = antes;
    return false;
  }
  const antes = despesas;
  despesas = despesas.filter((d) => d.id !== item.id);
  if (guardarDespesas()) return true;
  despesas = antes;
  return false;
}

function linhaDespesa(item, desenharDeNovo) {
  const chave = `${item.origem}:${item.id}`;
  const categoria = nomeCategoriaDespesa(item.categoria);
  if (chave === despesaAEditar) {
    const opcoes = {
      registo: item.registo,
      aoGuardar: (alterado) => {
        if (!alterarRegisto(item, alterado)) return;
        despesaAEditar = null;
        desenharDeNovo();
        avisar('Gasto alterado.');
      },
      aoCancelar: () => { despesaAEditar = null; desenharDeNovo(); },
      aoApagar: () => {
        const descricao = item.nota ? `${categoria}, ${item.nota}` : categoria;
        if (!confirm(`Apagar o gasto de ${formatarEuros(item.centimos)} (${descricao})?`)) return;
        if (!apagarRegisto(item)) return;
        despesaAEditar = null;
        desenharDeNovo();
        avisar('Gasto apagado.');
      },
    };
    // Os registos de "Registar compras" abrem com o formulário de sempre (data, loja e valor), na chave deles.
    const formulario = item.origem === 'compras' ? formularioGasto(opcoes) : formularioDespesa(opcoes);
    const titulo = item.origem === 'compras' ? `Editar compra (${categoria})` : 'Editar gasto';
    return criar('li', { className: 'gasto-editar' }, criar('h3', { className: 'despesas-registo-titulo', textContent: titulo }), formulario);
  }
  const data = textoParaData(item.data);
  return criar('li', {}, criar('button', {
    type: 'button',
    className: 'gasto-linha',
    'aria-label': `${formatarData(data, { day: 'numeric', month: 'long' })}, ${categoria}${item.nota ? `, ${item.nota}` : ''}, ${formatarEuros(item.centimos)}. Tocar para editar ou apagar.`,
    onclick: () => { despesaAEditar = chave; fecharNovaDespesa(); desenharDeNovo(); },
  },
  criar('span', { className: 'gasto-data', textContent: `${data.getDate()} ${MESES_ABREVIADOS[data.getMonth()]}` }),
  criar('span', { className: 'gasto-texto' },
    criar('span', { className: 'gasto-categoria', textContent: categoria }),
    ...(item.nota ? [criar('span', { className: 'gasto-nota', textContent: item.nota })] : [])),
  criar('span', { className: 'gasto-valor', textContent: formatarEuros(item.centimos) })));
}

function desenharDespesasMes(mes) {
  const chave = chaveMes(mes);
  const todos = todosOsGastos();
  const doMes = todos
    .filter((g) => g.data.startsWith(`${chave}-`))
    // Do mais recente para o mais antigo; no mesmo dia, o último registado primeiro (os ids começam pela hora).
    .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
  const doAno = todos.filter((g) => g.data.startsWith(`${mes.getFullYear()}-`));
  const total = somaCentimos(doMes);
  const redesenhar = () => desenharDespesasMes(mes);
  const nomeMes = NOMES_MESES[mes.getMonth()];

  // Total por categoria, do maior para o menor, com a barra em proporção do total do mês.
  const porCategoria = categoriasDespesas
    .map((c) => ({ nome: c.nome, centimos: somaCentimos(doMes.filter((g) => g.categoria === c.id)) }))
    .filter((c) => c.centimos > 0)
    .sort((a, b) => b.centimos - a.centimos);

  const linhasCategoria = porCategoria.map((c) => {
    const percentagem = Math.round((c.centimos / total) * 100);
    const barra = criar('span', { className: 'despesa-barra', 'aria-hidden': 'true' }, criar('span', {}));
    barra.firstChild.style.width = `${Math.max(percentagem, 1)}%`;
    return criar('li', { 'aria-label': `${c.nome}: ${formatarEuros(c.centimos)}, ${percentagem}% do mês` },
      criar('span', { className: 'despesa-categoria-linha', 'aria-hidden': 'true' },
        criar('span', { className: 'gasto-categoria', textContent: c.nome }),
        criar('span', { className: 'gasto-valor', textContent: formatarEuros(c.centimos) })),
      barra);
  });

  const partes = [
    criar('div', { className: 'mes-cartao gastos-total' },
      criar('p', { className: 'mes-valor', textContent: formatarEuros(total) }),
      criar('p', { className: 'mes-legenda', textContent: `gasto em ${nomeMes} · ${doMes.length} ${doMes.length === 1 ? 'gasto' : 'gastos'}` }),
      ...(linhasCategoria.length ? [criar('ul', { className: 'despesas-categorias' }, ...linhasCategoria)] : []),
      criar('p', { className: 'mes-pormenor', textContent: `Total de ${mes.getFullYear()}: ${formatarEuros(somaCentimos(doAno))}` })),
  ];
  if (doMes.length) {
    partes.push(criar('ul', { className: 'gastos-lista' }, ...doMes.map((g) => linhaDespesa(g, redesenhar))));
  } else {
    partes.push(criar('div', { className: 'mes-vazio' },
      criar('p', { className: 'mes-vazio-titulo', textContent: `Sem gastos registados em ${nomeMes}.` }),
      criar('p', { textContent: 'Toca em "Registar gasto" para acrescentar um.' })));
  }
  const caixa = document.getElementById('mes-gastos');
  caixa.dataset.mes = chave;
  caixa.replaceChildren(...partes);
}

// --- Categorias de gastos ---
const estadoCategoriasDespesas = { aRenomear: null };

function itensCategoriasDespesas() {
  const todos = todosOsGastos();
  return categoriasDespesas.map((c) => {
    const numero = todos.filter((g) => g.categoria === c.id).length;
    return {
      chave: c.id,
      nome: c.nome,
      podeRenomear: true,
      podeApagar: !CATEGORIAS_FIXAS.includes(c.id),
      detalhe: `${numero} ${numero === 1 ? 'gasto' : 'gastos'}`,
    };
  });
}

function aposMudarCategorias() {
  correrSemFalhar(() => desenharDespesasMes(inicioDoMes(mesDeslocamento)));
  // Um formulário aberto tem a lista de categorias antiga: fecha-se, sem perder nada já guardado.
  fecharNovaDespesa();
}

function criarCategoriaDespesa(nome) {
  // As novas ficam no fim da lista, antes de Outros.
  categoriasDespesas = [...categoriasDespesas.slice(0, -1), { id: novoId(), nome }, categoriasDespesas[categoriasDespesas.length - 1]];
  if (!guardarCategoriasDespesas()) {
    categoriasDespesas = categoriasDespesas.filter((c) => c.nome !== nome);
    return 'Não foi possível guardar.';
  }
  aposMudarCategorias();
  return null;
}

// Os gastos guardam o id da categoria: renomear não mexe em nenhum gasto.
function renomearCategoriaDespesa(id, nome) {
  const categoria = categoriasDespesas.find((c) => c.id === id);
  if (!categoria) return 'Esta categoria já não existe.';
  const antigo = categoria.nome;
  categoria.nome = nome;
  if (!guardarCategoriasDespesas()) {
    categoria.nome = antigo;
    return 'Não foi possível guardar.';
  }
  aposMudarCategorias();
  if (antigo !== nome) avisar(`Categoria "${antigo}" passou a "${nome}".`);
  return null;
}

// Com gastos, avisa e pede confirmação; esses gastos passam para Outros.
function apagarCategoriaDespesa(id) {
  if (CATEGORIAS_FIXAS.includes(id)) return false;
  const categoria = categoriasDespesas.find((c) => c.id === id);
  if (!categoria) return false;
  const afetados = despesas.filter((d) => d.categoria === id);
  const outros = nomeCategoriaDespesa('outros');
  if (afetados.length > 0) {
    const texto = afetados.length === 1 ? 'tem 1 gasto, que passa' : `tem ${afetados.length} gastos, que passam`;
    if (!confirm(`A categoria "${categoria.nome}" ${texto} para "${outros}". Apagar a categoria?`)) return false;
  }
  const antesCategorias = categoriasDespesas;
  const antesDespesas = despesas.map((d) => ({ ...d }));
  despesas.forEach((d) => { if (d.categoria === id) d.categoria = 'outros'; });
  categoriasDespesas = categoriasDespesas.filter((c) => c.id !== id);
  // Primeiro os gastos e só depois a categoria: nenhum gasto fica a apontar para uma categoria que já não existe.
  if (!guardarDespesas() || !guardarCategoriasDespesas()) {
    despesas = antesDespesas;
    categoriasDespesas = antesCategorias;
    guardarDespesas();
    return false;
  }
  aposMudarCategorias();
  avisar(afetados.length
    ? `Categoria apagada. ${afetados.length} ${afetados.length === 1 ? 'gasto passou' : 'gastos passaram'} para "${outros}".`
    : 'Categoria apagada.');
  return true;
}

function desenharCategoriasDespesas() {
  desenharGestorCategorias(document.getElementById('despesas-categorias'), {
    obterItens: itensCategoriasDespesas,
    estado: estadoCategoriasDespesas,
    prefixo: 'despesas-categoria',
    aoCriar: criarCategoriaDespesa,
    aoRenomear: renomearCategoriaDespesa,
    aoApagar: apagarCategoriaDespesa,
  });
}

document.getElementById('despesas-categorias-caixa').addEventListener('toggle', (evento) => {
  if (evento.target.open) desenharCategoriasDespesas();
  else estadoCategoriasDespesas.aRenomear = null;
});

// Na primeira vez, as categorias iniciais ficam logo guardadas no aparelho.
try {
  if (!localStorage.getItem(CHAVE_CATEGORIAS_DESPESAS)) guardarCategoriasDespesas();
} catch (erro) { /* sem acesso: a lista volta a ser feita da mesma forma da próxima vez */ }
