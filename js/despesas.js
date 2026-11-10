// despesas.js: secção "Gastos do mês" da vista Gastos. Gastos gerais, por categoria, com as categorias editáveis,
// e a barra fixa com o total do mês. Os gastos gerais e as categorias ficam em chaves próprias. Os registos de
// "Registar compras" (gastos.js) continuam na chave deles e aparecem aqui na categoria Mercearia, sem serem alterados.

const CHAVE_DESPESAS = 'organizador-despesas';
const CHAVE_CATEGORIAS_DESPESAS = 'organizador-categorias-despesas';
const NOTA_MAXIMA = 120; // letras

// Mercearia e Outros têm id fixo: os registos de compras vão para a primeira e os de categorias apagadas para a segunda.
// Supermercado era a categoria fixa dos registos de compras até 10 nov 2026; agora é uma categoria como as outras.
const CATEGORIAS_DESPESAS_INICIAIS = [
  { id: 'mercearia', nome: 'Mercearia' },
  { id: 'supermercado', nome: 'Supermercado' },
  { id: 'combustivel', nome: 'Combustível' },
  { id: 'restauracao', nome: 'Restauração e lazer' },
  { id: 'bebe', nome: 'Produtos bebé' },
  { id: 'saude', nome: 'Saúde' },
  { id: 'outros', nome: 'Outros' },
];
const CATEGORIAS_FIXAS = ['mercearia', 'outros'];

// Lista limpa: ids e nomes únicos (sem contar maiúsculas e acentos), Mercearia e Outros sempre presentes, Outros no fim.
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
    if (id === 'mercearia') limpas.unshift({ id, nome });
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
        // Nome do comerciante tal como veio no ficheiro do cartão (só nos importados a partir de 10 nov 2026).
        ...(typeof d.comerciante === 'string' && d.comerciante.trim() ? { comerciante: d.comerciante.trim().slice(0, NOTA_MAXIMA) } : {}),
        // Marca dos gastos importados do cartão (ver importarGastosCartao): só existe nesses.
        ...(typeof d.cartao === 'string' && d.cartao ? { cartao: d.cartao } : {}),
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

// Uma categoria "Mercearia" criada antes à mão passa a ser a Mercearia da app (id fixo "mercearia"), com os seus gastos
// e regras. Recebe as listas em bruto, antes de serem limpas, e devolve-as com o id trocado; sem nada a trocar, iguais.
function adotarMercearia(categorias, ...listas) {
  if (!Array.isArray(categorias) || categorias.some((c) => c && c.id === 'mercearia')) return [categorias, ...listas];
  const mesma = categorias.find((c) => c && typeof c.nome === 'string' && chaveTexto(c.nome) === 'mercearia');
  if (!mesma) return [categorias, ...listas];
  const trocar = (item) => (item && item.categoria === mesma.id ? { ...item, categoria: 'mercearia' } : item);
  return [
    categorias.map((c) => (c === mesma ? { ...c, id: 'mercearia' } : c)),
    ...listas.map((lista) => (Array.isArray(lista) ? lista.map(trocar) : lista)),
  ];
}

const categoriasGuardadas = lerChave(CHAVE_CATEGORIAS_DESPESAS, 'categorias');
const despesasGuardadas = lerChave(CHAVE_DESPESAS, 'registos');
const [categoriasAdotadas, despesasAdotadas] = adotarMercearia(categoriasGuardadas, despesasGuardadas);
let categoriasDespesas = normalizarCategoriasDespesas(categoriasAdotadas || CATEGORIAS_DESPESAS_INICIAIS);
let despesas = normalizarDespesas(despesasAdotadas || [], categoriasDespesas);

// Na primeira vez com a Mercearia: guarda uma cópia das categorias e dos gastos de antes e grava já a mudança.
if (categoriasGuardadas && !categoriasGuardadas.some((c) => c && c.id === 'mercearia')) {
  try {
    [[CHAVE_CATEGORIAS_DESPESAS, { versao: 1, categorias: categoriasGuardadas }], [CHAVE_DESPESAS, { versao: 1, registos: despesasGuardadas || [] }]]
      .forEach(([chave, valor]) => {
        if (!localStorage.getItem(chave + '-antes-da-mercearia')) localStorage.setItem(chave + '-antes-da-mercearia', JSON.stringify(valor));
      });
    localStorage.setItem(CHAVE_CATEGORIAS_DESPESAS, JSON.stringify({ versao: 1, categorias: categoriasDespesas }));
    localStorage.setItem(CHAVE_DESPESAS, JSON.stringify({ versao: 1, registos: despesas }));
  } catch (erro) { /* sem espaço: a mudança volta a ser feita da próxima vez, da mesma forma */ }
}

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

// Todos os gastos num só formato: os gerais (incluindo os importados do cartão) e os de "Registar compras"
// (em Mercearia, com a loja como nota). Cada registo aparece uma só vez: é daqui que sai o total do mês.
function todosOsGastos() {
  return [
    ...despesas.map((d) => ({ origem: 'despesa', id: d.id, data: d.data, categoria: d.categoria, nota: d.nota, centimos: d.centimos, registo: d })),
    ...gastos.map((g) => ({ origem: 'compras', id: g.id, data: g.data, categoria: 'mercearia', nota: g.loja, centimos: g.centimos, registo: g })),
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
  // Nos gastos importados do cartão, a nota é o nome do comerciante.
  const doCartao = Boolean(registo && registo.cartao);
  const nota = campo('nota', doCartao ? 'Comerciante' : 'Nota (opcional)', criar('input', {
    type: 'text', value: registo ? registo.nota : '', placeholder: doCartao ? 'Ex.: Pingo Doce' : 'Ex.: farmácia', autocomplete: 'off', autocapitalize: 'sentences', enterKeyHint: 'done', maxLength: NOTA_MAXIMA,
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

  const campos = doCartao ? [nota, data, valor, categoria] : [data, categoria, valor, nota];
  const formulario = criar('form', { className: 'formulario formulario-gasto', noValidate: true },
    ...campos.map((parte) => parte.rotulo), ...botoes);
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const lido = lerValor(valor.entrada.value);
    const existe = categoriasDespesas.some((c) => c.id === categoria.entrada.value);
    const erros = [
      ...(doCartao ? [[nota, nota.entrada.value.trim() ? null : 'Escreve o nome do comerciante.']] : []),
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
  // "Seguinte" no teclado do valor passa para a nota, em vez de guardar logo (nos do cartão, a nota vem primeiro).
  valor.entrada.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter' || doCartao) return;
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
        const antes = { ...item.registo };
        if (!alterarRegisto(item, alterado)) return;
        despesaAEditar = null;
        // Mudar a categoria de um gasto do cartão ensina a app a categoria desse comerciante (comerciantes.js).
        const lembrou = item.origem === 'despesa' && item.registo.cartao && alterado.categoria !== antes.categoria
          ? lembrarComerciante(item.registo, antes) : null;
        desenharDeNovo();
        avisar(lembrou || 'Gasto alterado.');
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

// Barra fixa no fundo da vista: o nome do mês e o total de tudo o que se gastou nele (mercearia e gastos gerais).
// O ano só aparece quando não é o atual.
function desenharTotalMes(mes, total) {
  const nome = primeiraMaiuscula(NOMES_MESES[mes.getMonth()]);
  document.getElementById('gastos-total-mes').textContent =
    mes.getFullYear() === new Date().getFullYear() ? nome : `${nome} ${mes.getFullYear()}`;
  document.getElementById('gastos-total-valor').textContent = formatarEuros(total);
}

function desenharDespesasMes(mes) {
  const chave = chaveMes(mes);
  const doMes = todosOsGastos()
    .filter((g) => g.data.startsWith(`${chave}-`))
    // Do mais recente para o mais antigo; no mesmo dia, o último registado primeiro (os ids começam pela hora).
    .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
  const redesenhar = () => desenharDespesasMes(mes);

  const caixa = document.getElementById('mes-gastos');
  caixa.dataset.mes = chave;
  caixa.replaceChildren(doMes.length
    ? criar('ul', { className: 'gastos-lista' }, ...doMes.map((g) => linhaDespesa(g, redesenhar)))
    : criar('p', { className: 'mes-vazio-curto', textContent: `Sem gastos em ${NOMES_MESES[mes.getMonth()]}.` }));
  desenharTotalMes(mes, somaCentimos(doMes));
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
  correrSemFalhar(desenharComerciantes);
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
  // Os comerciantes lembrados com esta categoria são esquecidos: voltam a entrar em "Por categorizar".
  esquecerRegrasDaCategoria(id);
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
  if (evento.target.open) {
    desenharCategoriasDespesas();
    desenharComerciantes();
  } else {
    estadoCategoriasDespesas.aRenomear = null;
    regraAEditar = null;
  }
});

// Na primeira vez, as categorias iniciais ficam logo guardadas no aparelho.
try {
  if (!localStorage.getItem(CHAVE_CATEGORIAS_DESPESAS)) guardarCategoriasDespesas();
} catch (erro) { /* sem acesso: a lista volta a ser feita da mesma forma da próxima vez */ }

// --- Importar gastos do cartão ---
// Ficheiro de texto (ex.: gastos-cartao.txt, escolhido no iCloud Drive), uma linha por gasto: "AAAA-MM-DD;Comerciante;Montante".
// O montante aceita vírgula ou ponto, com ou sem € e espaços. Cada linha passa a um gasto com o comerciante como nota,
// na categoria lembrada para esse comerciante (comerciantes.js) ou, se for um comerciante novo, em "Por categorizar". Cada linha importada tem uma marca "data|comerciante|cêntimos", guardada no gasto
// ("cartao") e contada em dados.cartaoImportados: ao importar outra vez, as linhas já importadas não se repetem,
// mesmo que o gasto tenha sido apagado ou alterado entretanto. Linhas iguais no mesmo ficheiro contam uma a uma
// (duas compras iguais no mesmo dia entram as duas).
const CATEGORIA_POR_CATEGORIZAR = 'Por categorizar';
const FICHEIRO_CARTAO_MAXIMO = 1024 * 1024; // 1 MB

// Devolve { data, nota, centimos, marca } ou null se a linha estiver mal formada.
function lerLinhaCartao(linha) {
  const partes = linha.split(';');
  if (partes.length < 3) return null;
  const data = partes[0].trim();
  // O comerciante pode ter ";" no nome: fica tudo o que está entre a data e o montante.
  const comerciante = partes.slice(1, -1).join(';').replace(/\s+/g, ' ').trim();
  const valor = lerValor(partes[partes.length - 1]);
  if (!dataValida(data) || valor.erro) return null;
  return {
    data,
    comerciante,
    nota: (comerciante || 'Sem nome').slice(0, NOTA_MAXIMA),
    centimos: valor.centimos,
    marca: `${data}|${chaveTexto(comerciante)}|${valor.centimos}`,
  };
}

function lerFicheiroCartao(texto) {
  // Sem a marca BOM do início e sem as linhas vazias do fim (o "Enter" depois da última linha não conta).
  const linhas = texto.replace(/^\uFEFF/, '').replace(/\s+$/, '');
  if (!linhas) return { validas: [], ignoradas: 0 };
  const validas = [];
  let ignoradas = 0;
  linhas.split(/\r\n|\r|\n/).forEach((linha) => {
    const lida = linha.trim() ? lerLinhaCartao(linha) : null;
    if (lida) validas.push(lida);
    else ignoradas += 1;
  });
  return { validas, ignoradas };
}

// Id da categoria "Por categorizar"; se ainda não existir, é criada antes de Outros. Devolve null se não der para guardar.
function garantirCategoriaPorCategorizar() {
  const existente = categoriasDespesas.find((c) => chaveTexto(c.nome) === chaveTexto(CATEGORIA_POR_CATEGORIZAR));
  if (existente) return existente.id;
  const id = categoriasDespesas.some((c) => c.id === 'por-categorizar') ? novoId() : 'por-categorizar';
  const antes = categoriasDespesas;
  categoriasDespesas = [...categoriasDespesas.slice(0, -1), { id, nome: CATEGORIA_POR_CATEGORIZAR }, categoriasDespesas[categoriasDespesas.length - 1]];
  if (!guardarCategoriasDespesas()) {
    categoriasDespesas = antes;
    return null;
  }
  return id;
}

function mostrarResultadoCartao(texto) {
  const resultado = document.getElementById('despesas-importar-resultado');
  resultado.textContent = texto;
  resultado.hidden = false;
}

async function importarGastosCartao(ficheiro) {
  let lido;
  try {
    if (ficheiro.size > FICHEIRO_CARTAO_MAXIMO) throw new Error('Ficheiro grande demais');
    lido = lerFicheiroCartao(await ficheiro.text());
  } catch (erro) {
    mostrarResultadoCartao('Não foi possível ler este ficheiro. Nada foi alterado.');
    return;
  }
  const { validas, ignoradas } = lido;
  const textoIgnoradas = `${ignoradas} ${ignoradas === 1 ? 'linha ignorada' : 'linhas ignoradas'}`;
  if (validas.length === 0) {
    mostrarResultadoCartao(ignoradas === 0
      ? 'O ficheiro está vazio. Nada foi importado.'
      : `Nenhum gasto válido no ficheiro (${textoIgnoradas}). Cada linha deve ser "AAAA-MM-DD;Comerciante;Montante".`);
    return;
  }

  // Quantas linhas com cada marca já foram importadas: cada linha do ficheiro "gasta" uma delas; as que sobram são novas.
  // Conta pelo registo e pelos gastos com a marca (o maior dos dois), para servir também depois de importar uma cópia antiga.
  const nosGastos = new Map();
  despesas.forEach((d) => {
    if (d.cartao) nosGastos.set(d.cartao, (nosGastos.get(d.cartao) || 0) + 1);
  });
  const jaImportados = new Map();
  new Set([...nosGastos.keys(), ...Object.keys(dados.cartaoImportados)]).forEach((marca) => {
    jaImportados.set(marca, Math.max(nosGastos.get(marca) || 0, dados.cartaoImportados[marca] || 0));
  });
  const novas = [];
  let repetidas = 0;
  validas.forEach((linha) => {
    const restantes = jaImportados.get(linha.marca) || 0;
    if (restantes > 0) {
      jaImportados.set(linha.marca, restantes - 1);
      repetidas += 1;
    } else {
      novas.push(linha);
    }
  });

  // Comerciantes já lembrados entram com a sua categoria (e o nome a mostrar, se houver); os novos, em "Por categorizar".
  const comRegra = novas.map((linha) => ({ linha, regra: linha.comerciante ? regraDoComerciante(linha.comerciante) : null }));
  const lembrados = comRegra.filter((n) => n.regra).length;
  if (novas.length > 0) {
    const porCategorizar = lembrados < novas.length ? garantirCategoriaPorCategorizar() : null;
    if (lembrados < novas.length && !porCategorizar) return; // já foi avisado de que não deu para guardar
    const antes = despesas;
    despesas = [...despesas, ...comRegra.map(({ linha, regra }) => ({
      id: novoId(),
      data: linha.data,
      categoria: regra ? regra.categoria : porCategorizar,
      centimos: linha.centimos,
      nota: regra && regra.nome ? regra.nome : linha.nota,
      cartao: linha.marca,
      ...(linha.comerciante ? { comerciante: linha.comerciante } : {}),
    }))];
    if (!guardarDespesas()) {
      despesas = antes;
      return;
    }
    // O registo fica com o total de cada marca: o que já lá estava ou, se o ficheiro tiver mais, o número de linhas do ficheiro.
    const noFicheiro = new Map();
    validas.forEach((linha) => noFicheiro.set(linha.marca, (noFicheiro.get(linha.marca) || 0) + 1));
    noFicheiro.forEach((numero, marca) => {
      dados.cartaoImportados[marca] = Math.max(dados.cartaoImportados[marca] || 0, nosGastos.get(marca) || 0, numero);
    });
    guardarDados();
    // Leva o seletor para o mês do gasto novo mais recente, para se ver logo na lista.
    const [ano, mes] = novas.map((linha) => linha.data).sort().pop().split('-').map(Number);
    const hoje = new Date();
    mesDeslocamento = (ano - hoje.getFullYear()) * 12 + (mes - 1 - hoje.getMonth());
    despesaAEditar = null;
    fecharNovaDespesa();
    desenharMes();
    const caixaCategorias = document.getElementById('despesas-categorias-caixa');
    if (caixaCategorias.open) desenharCategoriasDespesas();
  }

  const partes = [
    `${novas.length} ${novas.length === 1 ? 'gasto novo' : 'gastos novos'}`,
    `${repetidas} já ${repetidas === 1 ? 'importado' : 'importados'}`,
    textoIgnoradas,
  ];
  const semRegra = novas.length - lembrados;
  const dicas = [];
  if (lembrados > 0) dicas.push(`${lembrados} com a categoria lembrada do comerciante.`);
  if (semRegra > 0) dicas.push(`${semRegra} em "${CATEGORIA_POR_CATEGORIZAR}": toca num gasto para mudar a categoria.`);
  const dica = dicas.length ? ` ${dicas.join(' ')}` : '';
  mostrarResultadoCartao(`Importação: ${partes.join(' · ')}.${dica}`);
}

document.getElementById('despesas-importar-cartao').addEventListener('change', async (evento) => {
  const ficheiro = evento.target.files[0];
  evento.target.value = ''; // permite escolher o mesmo ficheiro outra vez
  if (ficheiro) await importarGastosCartao(ficheiro);
});
