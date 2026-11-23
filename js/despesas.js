// despesas.js: secção "Gastos do mês" da vista Gastos, agrupada por categoria (uma linha por categoria com gastos, que
// abre ali mesmo os gastos dela). Gastos gerais, com as categorias editáveis,
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

// Tipo de uma categoria ou de um gasto: "casa" ou "pessoal". As categorias sem tipo (as de antes de 21 nov 2026 e as das
// cópias antigas) são da casa. Um gasto só tem "tipo" quando foi marcado à parte, diferente do da sua categoria; sem ele,
// segue sempre a categoria (também se ela mudar de tipo mais tarde). "Por categorizar" não tem tipo: aparece à parte.
const TIPOS_GASTO = ['casa', 'pessoal'];

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
    limpas.push({ id: c.id, nome, ...(TIPOS_GASTO.includes(c.tipo) ? { tipo: c.tipo } : {}) });
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

// Valores da coluna "origem" do ficheiro CSV (ver exportar-csv.js).
const ORIGENS_CSV = ['compras', 'manual', 'cartao'];

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
        // Nota escrita à mão num gasto do cartão (ex.: "fraldas"), desde 23 nov 2026: só nos gastos com cartao. A nota
        // continua a ser o nome do comerciante; a importação do cartão nunca escreve nem apaga este campo.
        ...(typeof d.cartao === 'string' && d.cartao && typeof d.detalhe === 'string' && d.detalhe.replace(/\s+/g, ' ').trim()
          ? { detalhe: d.detalhe.replace(/\s+/g, ' ').trim().slice(0, NOTA_MAXIMA) } : {}),
        // Gastos de outra pessoa, importados de um ficheiro "Exportar gastos (CSV)" (importar-csv.js): o nome como veio
        // no ficheiro, a marca "pessoa|id" (para não voltarem a entrar) e a origem no outro aparelho. Os meus não os têm.
        ...(typeof d.pessoa === 'string' && d.pessoa.trim() ? { pessoa: d.pessoa.replace(/\s+/g, ' ').trim().slice(0, 60) } : {}),
        ...(typeof d.csvMarca === 'string' && d.csvMarca ? { csvMarca: d.csvMarca } : {}),
        ...(ORIGENS_CSV.includes(d.origemOriginal) ? { origemOriginal: d.origemOriginal } : {}),
        // Gasto marcado à parte ("casa" ou "pessoal", diferente do tipo da categoria). Sem ele, segue a categoria.
        ...(TIPOS_GASTO.includes(d.tipo) ? { tipo: d.tipo } : {}),
        // Gastos criados por um gasto fixo (fixos.js): o id do fixo, o mês "AAAA-MM" a que pertencem e, só enquanto o
        // valor não for confirmado, porConfirmar.
        ...(typeof d.fixoId === 'string' && d.fixoId ? { fixoId: d.fixoId } : {}),
        ...(typeof d.fixoMes === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(d.fixoMes) ? { fixoMes: d.fixoMes } : {}),
        ...(d.porConfirmar === true ? { porConfirmar: true } : {}),
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

// Categorias de gastos por ordem alfabética, só para o ecrã; a de id "outros" fica sempre em último,
// mesmo renomeada. categoriasDespesas e a chave guardada continuam pela ordem guardada.
function categoriasDespesasOrdenadas() {
  return ordenarCategorias(categoriasDespesas, (c) => c.nome, (c) => c.id === 'outros');
}

function nomeCategoriaDespesa(id) {
  const categoria = categoriasDespesas.find((c) => c.id === id);
  return categoria ? categoria.nome : 'Outros';
}

// Tipo de uma categoria: "pessoal" ou "casa" (por defeito); null para "Por categorizar", que não tem tipo.
function tipoDaCategoria(id) {
  if (ePorCategorizar(id)) return null;
  const categoria = categoriasDespesas.find((c) => c.id === id);
  return categoria && categoria.tipo === 'pessoal' ? 'pessoal' : 'casa';
}

// Bloco de "Gastos do mês" de um gasto (item de todosOsGastos): "por-categorizar", ou o tipo efetivo (o do gasto, se
// tiver sido marcado à parte, ou o da categoria). Os registos de "Registar compras" seguem sempre a Mercearia.
function blocoDoGasto(g) {
  if (ePorCategorizar(g.categoria)) return 'por-categorizar';
  return g.tipo || tipoDaCategoria(g.categoria);
}

// Um gasto marcado à parte: tem tipo próprio e é diferente do da categoria (em "Por categorizar", basta ter tipo).
function marcadoAParte(g) {
  return Boolean(g.tipo) && g.tipo !== tipoDaCategoria(g.categoria);
}

// Todos os gastos num só formato: os gerais (incluindo os importados do cartão) e os de "Registar compras"
// (em Mercearia, com a loja como nota). Cada registo aparece uma só vez: é daqui que sai o total do mês.
// "pessoa" só existe nos gastos de outra pessoa (importados de um CSV); os meus têm-na vazia.
function todosOsGastos() {
  return [
    ...despesas.map((d) => ({ origem: 'despesa', id: d.id, data: d.data, categoria: d.categoria, nota: d.nota, centimos: d.centimos, pessoa: d.pessoa || '', tipo: d.tipo || null, registo: d })),
    ...gastos.map((g) => ({ origem: 'compras', id: g.id, data: g.data, categoria: 'mercearia', nota: g.loja, centimos: g.centimos, pessoa: '', tipo: null, registo: g })),
  ];
}

// --- Seletor "Meus · <pessoa> · Juntos" ---
// Só aparece quando há gastos de outra pessoa (importados de um CSV). "meus": os gastos sem pessoa (incluindo os de
// "Registar compras"); "casa": todos (o botão diz "Juntos" desde 21 nov 2026, para não se confundir com os gastos da casa); outro valor: a chave (nome normalizado, chaveTexto) de uma pessoa.
// Não fica guardado: a app abre sempre em "Meus", e a escolha mantém-se enquanto a app estiver aberta.
let escolhaPessoas = 'meus';

// --- Nome a mostrar de cada pessoa importada (Definições, "Pessoas dos gastos importados") ---
// Só para o ecrã deste aparelho: { pessoaNormalizada: "nome a mostrar" }. O campo "pessoa" dos gastos, a marca csvMarca
// e o CSV exportado ficam sempre com o nome original (senão, outro telemóvel voltaria a importar os mesmos gastos).
// Vai na cópia de segurança em "preferencias.nomesPessoas".
const CHAVE_NOMES_PESSOAS = 'organizador-nomes-pessoas';
const NOME_A_MOSTRAR_MAXIMO = 30; // letras

function limparNomeAMostrar(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim().slice(0, NOME_A_MOSTRAR_MAXIMO);
}

// Objeto limpo: só chaves com texto e nomes não vazios. Devolve null se não for um objeto.
function normalizarNomesPessoas(bruto) {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null;
  const limpos = {};
  Object.entries(bruto).forEach(([chave, nome]) => {
    const limpo = typeof nome === 'string' ? limparNomeAMostrar(nome) : '';
    if (chave && limpo) limpos[chave] = limpo;
  });
  return limpos;
}

function lerNomesPessoas() {
  try {
    return normalizarNomesPessoas(JSON.parse(localStorage.getItem(CHAVE_NOMES_PESSOAS) || '{}')) || {};
  } catch (erro) {
    return {};
  }
}

// Devolve false se não der para guardar. Sem nenhum nome, a chave é apagada.
function guardarNomesPessoas(nomes) {
  try {
    if (Object.keys(nomes).length) localStorage.setItem(CHAVE_NOMES_PESSOAS, JSON.stringify(nomes));
    else localStorage.removeItem(CHAVE_NOMES_PESSOAS);
    return true;
  } catch (erro) {
    avisar('Não foi possível guardar. Exporta uma cópia de segurança.');
    return false;
  }
}

// O nome escolhido em Definições ou, sem ele, a primeira palavra do nome original.
function nomeAMostrar(nomeOriginal) {
  const escolhido = lerNomesPessoas()[chaveTexto(nomeOriginal)];
  return escolhido || nomeOriginal.trim().split(/\s+/)[0];
}

// Pessoas com gastos importados, em qualquer período: [{ chave, nome, mostrar }], por ordem alfabética do nome
// original. "nome" é o do gasto mais recente dessa pessoa, tal como veio no ficheiro; "mostrar", o nome a mostrar.
function pessoasImportadas() {
  const porChave = new Map();
  [...despesas].sort((a, b) => a.data.localeCompare(b.data)).forEach((d) => {
    if (d.pessoa) porChave.set(chaveTexto(d.pessoa), d.pessoa);
  });
  return [...porChave].map(([chave, nome]) => ({ chave, nome, mostrar: nomeAMostrar(nome) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-PT', { sensitivity: 'base' }));
}

// Mensagens dos botões do topo dos Gastos ("Importar do cartão", "Exportar (CSV)" e "Importar (CSV)"): uma só caixa,
// por baixo dos botões CSV. Vazio esconde-a.
function mostrarResultadoGastos(texto) {
  const resultado = document.getElementById('gastos-resultado');
  resultado.textContent = texto;
  resultado.hidden = !texto;
}

// Os gastos da escolha atual (recebe itens de todosOsGastos).
function gastosDaEscolha(lista) {
  if (escolhaPessoas === 'casa') return lista;
  if (escolhaPessoas === 'meus') return lista.filter((g) => !g.pessoa);
  return lista.filter((g) => g.pessoa && chaveTexto(g.pessoa) === escolhaPessoas);
}

// Depois de registar um gasto meu: se o seletor estiver noutra pessoa, passa para "Meus", para o gasto se ver.
function mostrarMeusSeForOutraPessoa() {
  if (escolhaPessoas !== 'meus' && escolhaPessoas !== 'casa') escolhaPessoas = 'meus';
}

function desenharSeletorPessoas() {
  const caixa = document.getElementById('gastos-pessoas');
  const pessoas = pessoasImportadas();
  // Sem gastos de outra pessoa (ou se a escolhida deixou de ter gastos), volta a "Meus".
  if (escolhaPessoas !== 'meus' && escolhaPessoas !== 'casa' && !pessoas.some((p) => p.chave === escolhaPessoas)) escolhaPessoas = 'meus';
  if (pessoas.length === 0) escolhaPessoas = 'meus';
  // Para o CSS: com o seletor, a barra do total pode ter a linha "Juntos:".
  document.body.classList.toggle('gastos-com-pessoas', pessoas.length > 0);
  caixa.hidden = pessoas.length === 0;
  const focada = caixa.contains(document.activeElement) ? document.activeElement.dataset.escolha : null;
  const opcoes = [{ chave: 'meus', nome: 'Meus', mostrar: 'Meus' }, ...pessoas, { chave: 'casa', nome: 'Juntos', mostrar: 'Juntos' }];
  // Todos os botões com a mesma largura (grelha com colunas iguais, ver style.css).
  caixa.style.setProperty('--colunas', opcoes.length);
  caixa.replaceChildren(...opcoes.map((o) => criar('button', {
    type: 'button',
    className: o.chave === 'meus' || o.chave === 'casa' ? 'pessoa-fixa' : 'pessoa-nome',
    textContent: o.mostrar,
    title: o.nome,
    // Com o nome encurtado, o leitor de ecrã diz também o nome completo.
    ...(o.mostrar !== o.nome ? { 'aria-label': `${o.mostrar} (${o.nome})` } : {}),
    'aria-pressed': String(o.chave === escolhaPessoas),
    onclick: () => {
      if (escolhaPessoas === o.chave) return;
      escolhaPessoas = o.chave;
      despesaAEditar = null;
      desenharDespesasMes(periodoDoDeslocamento(mesDeslocamento));
    },
  })));
  caixa.querySelectorAll('button').forEach((botao, i) => { botao.dataset.escolha = opcoes[i].chave; });
  if (focada) {
    const botao = [...caixa.querySelectorAll('button')].find((b) => b.dataset.escolha === focada);
    if (botao) botao.focus({ preventScroll: true });
  }
  return pessoas.length > 0;
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
    ...categoriasDespesasOrdenadas().map((c) => criar('option', { value: c.id, textContent: c.nome }))));
  // Um gasto novo começa na primeira categoria guardada (normalmente Mercearia), como antes.
  categoria.entrada.value = registo ? registo.categoria : categoriasDespesas[0].id;
  // "É um gasto": "Da casa" / "Pessoal". Começa no tipo efetivo (o do gasto, se foi marcado à parte, ou o da categoria) e,
  // enquanto não se tocar nele neste formulário, acompanha a mudança de categoria. Um gasto já marcado à parte começa
  // com a sua marca, que não muda sozinha. Com "Por categorizar" escolhida (sem tipo), fica escondido.
  let tipoTocado = Boolean(registo && TIPOS_GASTO.includes(registo.tipo));
  const tipo = escolhaDeDuas({
    id: `despesa-tipo-${n}`,
    rotulo: 'É um gasto',
    opcoes: [['casa', 'Da casa'], ['pessoal', 'Pessoal']],
    valor: tipoTocado ? registo.tipo : (tipoDaCategoria(categoria.entrada.value) || 'casa'),
    aoMudar: () => { tipoTocado = true; },
  });
  const notaTipo = criar('p', { className: 'nota nota-campo nota-tipo', textContent: 'Começa como a categoria. Muda só este gasto.' });
  const caixaTipo = criar('div', { className: 'campo-tipo' }, tipo.elemento, notaTipo);
  const acertarTipo = () => {
    const daCategoria = tipoDaCategoria(categoria.entrada.value);
    caixaTipo.hidden = daCategoria === null;
    if (!tipoTocado && daCategoria) tipo.definir(daCategoria);
  };
  acertarTipo();
  categoria.entrada.addEventListener('change', acertarTipo);
  const valor = campo('valor', 'Valor total (€)', criar('input', {
    type: 'text', value: registo ? valorParaCampo(registo.centimos) : '', placeholder: '0,00', inputMode: 'decimal', autocomplete: 'off', enterKeyHint: 'next',
  }));
  // Nos gastos importados do cartão, a nota é o nome do comerciante.
  const doCartao = Boolean(registo && registo.cartao);
  const nota = campo('nota', doCartao ? 'Comerciante' : 'Nota (opcional)', criar('input', {
    type: 'text', value: registo ? registo.nota : '', placeholder: doCartao ? 'Ex.: Pingo Doce' : 'Ex.: farmácia', autocomplete: 'off', autocapitalize: 'sentences', enterKeyHint: doCartao ? 'next' : 'done', maxLength: NOTA_MAXIMA,
  }));
  // Nos do cartão, logo por baixo do comerciante: uma nota à parte ("detalhe"), que não mexe no comerciante nem nos
  // comerciantes lembrados.
  const detalhe = doCartao ? campo('detalhe', 'Nota (opcional)', criar('input', {
    type: 'text', value: registo.detalhe || '', placeholder: 'Ex.: fraldas', autocomplete: 'off', autocapitalize: 'sentences', enterKeyHint: 'done', maxLength: NOTA_MAXIMA,
  })) : null;
  const guardar = criar('button', { type: 'submit', className: 'botao-principal', textContent: registo ? 'Guardar alterações' : 'Guardar' });
  const botoes = [guardar, criar('button', { type: 'button', className: 'botao-secundario', textContent: 'Cancelar', onclick: aoCancelar })];
  if (aoApagar) botoes.push(criar('button', { type: 'button', className: 'botao-apagar-registo', textContent: 'Apagar gasto', onclick: aoApagar }));

  const mostrarErro = (parte, mensagem) => {
    parte.erro.textContent = mensagem || '';
    parte.erro.hidden = !mensagem;
    if (mensagem) parte.entrada.setAttribute('aria-invalid', 'true');
    else parte.entrada.removeAttribute('aria-invalid');
  };

  const campos = doCartao ? [nota, detalhe, data, valor, categoria] : [data, categoria, valor, nota];
  // O tipo fica logo por baixo da categoria.
  const elementos = campos.flatMap((parte) => (parte === categoria ? [parte.rotulo, caixaTipo] : [parte.rotulo]));
  const formulario = criar('form', { className: 'formulario formulario-gasto', noValidate: true },
    ...elementos, ...botoes);
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
    // "tipo" só fica gravado se for diferente do da categoria (senão, o gasto segue a categoria); undefined apaga-o.
    // Em "Por categorizar", fica o que o gasto já tinha (ex.: o tipo que veio de um CSV).
    const daCategoria = tipoDaCategoria(categoria.entrada.value);
    const tipoFinal = daCategoria === null
      ? (registo && TIPOS_GASTO.includes(registo.tipo) ? registo.tipo : undefined)
      : (tipo.valor() !== daCategoria ? tipo.valor() : undefined);
    aoGuardar({
      data: data.entrada.value,
      categoria: categoria.entrada.value,
      centimos: lido.centimos,
      nota: nota.entrada.value.replace(/\s+/g, ' ').trim().slice(0, NOTA_MAXIMA),
      tipo: tipoFinal,
      // Só nos do cartão; vazio (undefined) apaga o campo.
      ...(doCartao ? { detalhe: detalhe.entrada.value.replace(/\s+/g, ' ').trim().slice(0, NOTA_MAXIMA) || undefined } : {}),
    });
  });
  [data, categoria, valor, nota, ...(detalhe ? [detalhe] : [])].forEach((parte) => {
    parte.entrada.addEventListener('input', () => mostrarErro(parte, null));
  });
  // "Seguinte" no teclado do valor passa para a nota, em vez de guardar logo (nos do cartão, a nota vem primeiro).
  valor.entrada.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter' || doCartao) return;
    evento.preventDefault();
    nota.entrada.focus();
  });
  // "Seguinte" no teclado do comerciante passa para a nota.
  if (detalhe) {
    nota.entrada.addEventListener('keydown', (evento) => {
      if (evento.key !== 'Enter') return;
      evento.preventDefault();
      detalhe.entrada.focus();
    });
  }
  formulario.addEventListener('focusin', () => setTimeout(() => manterVisivel(guardar), 350));
  return formulario;
}

// --- Secção "Gastos" ---
let despesaAEditar = null; // "despesa:id" ou "compras:id" do gasto aberto para editar
// Um gasto fixo por confirmar abre primeiro o painel "Valor deste mês" ("confirmar"); "Editar" passa ao formulário de
// sempre ("editar").
let modoDespesaAEditar = 'editar';
// Valor escrito no painel "Valor deste mês", por gasto, enquanto a app estiver aberta: não se perde se a lista for
// desenhada outra vez (ex.: ao voltar à app depois de ver a fatura noutra app).
const valoresAConfirmar = new Map();
const caixaNovaDespesa = document.getElementById('despesas-registo');
const botaoNovaDespesa = document.getElementById('despesas-registar');

function fecharNovaDespesa() {
  caixaNovaDespesa.replaceChildren();
  caixaNovaDespesa.hidden = true;
  botaoNovaDespesa.setAttribute('aria-expanded', 'false');
  fechadoSemVoltar('registar-gasto');
}

function abrirNovaDespesa() {
  if (despesaAEditar) {
    despesaAEditar = null;
    desenharDespesasMes(periodoDoDeslocamento(mesDeslocamento));
  }
  caixaNovaDespesa.replaceChildren(
    criar('h3', { className: 'despesas-registo-titulo', textContent: 'Registar gasto' }),
    formularioDespesa({
      aoGuardar: (novo) => {
        const id = novoId();
        const { tipo, ...resto } = novo;
        despesas.push({ id, ...resto, ...(tipo ? { tipo } : {}) });
        if (!guardarDespesas()) {
          despesas.pop();
          return;
        }
        fecharNovaDespesa();
        mostrarMeusSeForOutraPessoa();
        gastosADestacar = [`despesa:${id}`];
        // Leva o seletor para o período do gasto, para se ver logo na lista.
        mesDeslocamento = deslocamentoDaData(novo.data);
        desenharMes();
        avisar(`Registado: ${formatarEuros(novo.centimos)} em ${nomeCategoriaDespesa(novo.categoria)}.`);
      },
      aoCancelar: fecharNovaDespesa,
    }),
  );
  caixaNovaDespesa.hidden = false;
  botaoNovaDespesa.setAttribute('aria-expanded', 'true');
  abrirComVoltar('registar-gasto', 'gastos', fecharNovaDespesa);
}

botaoNovaDespesa.addEventListener('click', () => {
  if (caixaNovaDespesa.hidden) abrirNovaDespesa();
  else fecharNovaDespesa();
});

// Grava uma alteração; se não der para guardar, desfaz e devolve false.
// Um campo com undefined (ex.: "tipo" igual ao da categoria) é apagado do registo.
function alterarRegisto(item, alterado) {
  const antigo = { ...item.registo };
  const aplicar = (valores) => Object.entries(valores).forEach(([campo, valor]) => {
    if (valor === undefined) delete item.registo[campo];
    else item.registo[campo] = valor;
  });
  aplicar(alterado);
  const guardou = item.origem === 'compras' ? guardarGastos() : guardarDespesas();
  if (!guardou) {
    Object.keys(item.registo).forEach((campo) => { if (!(campo in antigo)) delete item.registo[campo]; });
    aplicar(antigo);
  }
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
  const porConfirmar = item.origem === 'despesa' && item.registo.porConfirmar === true;
  if (chave === despesaAEditar && porConfirmar && modoDespesaAEditar === 'confirmar') return painelConfirmarFixo(item, desenharDeNovo);
  if (chave === despesaAEditar) {
    const opcoes = {
      registo: item.registo,
      aoGuardar: (alterado) => {
        const antes = { ...item.registo };
        // Guardar a edição de um gasto fixo por confirmar também o dá como confirmado (o valor foi visto).
        if (porConfirmar) alterado = { ...alterado, porConfirmar: undefined };
        if (!alterarRegisto(item, alterado)) return;
        valoresAConfirmar.delete(chave);
        despesaAEditar = null;
        // Mudar a categoria de um gasto do cartão ensina a app a categoria desse comerciante (comerciantes.js).
        // Mudar só o nome de um comerciante já lembrado passa a ser o nome a mostrar nas importações seguintes.
        const doCartao = item.origem === 'despesa' && item.registo.cartao;
        let lembrou = null;
        if (doCartao && alterado.categoria !== antes.categoria) lembrou = lembrarComerciante(item.registo, antes);
        else if (doCartao && item.registo.nota !== antes.nota) lembrou = lembrarNomeDoComerciante(item.registo, antes);
        gastosADestacar = [chave];
        // Com outra data, o gasto pode passar para outro período: o seletor vai atrás dele.
        const deslocamento = deslocamentoDaData(item.registo.data);
        if (deslocamento !== mesDeslocamento) {
          mesDeslocamento = deslocamento;
          desenharMes();
          const periodo = periodoDaData(item.registo.data);
          avisar(`${lembrou || 'Gasto alterado.'} Passou para ${primeiraMaiuscula(NOMES_MESES[periodo.mes])} de ${periodo.ano}.`);
          return;
        }
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
    const li = criar('li', { className: 'gasto-editar' }, criar('h3', { className: 'despesas-registo-titulo', textContent: titulo }), formulario);
    li.dataset.gasto = chave;
    return li;
  }
  const data = textoParaData(item.data);
  // Em "Juntos", os gastos de outra pessoa mostram o nome a mostrar dela, pequeno, ao lado da nota.
  const pessoa = escolhaPessoas === 'casa' && item.pessoa ? nomeAMostrar(item.pessoa) : '';
  // Dentro da categoria, a linha mostra a nota (ou "Sem nota"); o nome da categoria já está na linha do grupo.
  // Num gasto do cartão com nota à parte: "<comerciante> · <nota>", numa só linha, com a nota em cor secundária e
  // cortada com reticências se não couber.
  const notaCartao = item.origem === 'despesa' && item.registo.cartao && item.registo.detalhe ? item.registo.detalhe : '';
  const detalhe = [criar('span', { className: item.nota ? 'gasto-nota-texto' : 'gasto-sem-nota', textContent: item.nota || 'Sem nota' })];
  if (notaCartao) {
    detalhe.push(criar('span', { className: 'gasto-separador', 'aria-hidden': 'true', textContent: ' · ' }),
      criar('span', { className: 'gasto-nota-cartao', textContent: notaCartao }));
  }
  if (pessoa) detalhe.push(' · ', criar('span', { className: 'gasto-pessoa', textContent: pessoa }));
  // Marcado à parte: por baixo da nota, pequeno.
  const marca = marcadoAParte(item) ? `marcado como ${item.tipo === 'pessoal' ? 'Pessoal' : 'da casa'}` : '';
  // Criado por um gasto fixo: "Fixo" ou, enquanto o valor não for confirmado, "Fixo · por confirmar" (em âmbar).
  const doFixo = item.origem === 'despesa' && item.registo.fixoId ? (porConfirmar ? 'Fixo · por confirmar' : 'Fixo') : '';
  const li = criar('li', {}, criar('button', {
    type: 'button',
    className: porConfirmar ? 'gasto-linha gasto-linha-por-confirmar' : 'gasto-linha',
    'aria-label': `${formatarData(data, { day: 'numeric', month: 'long' })}, ${categoria}${item.nota ? `, ${item.nota}` : ''}${notaCartao ? `, ${notaCartao}` : ''}${pessoa ? `, de ${pessoa}` : ''}${doFixo ? `, ${doFixo}` : ''}${marca ? `, ${marca}` : ''}, ${formatarEuros(item.centimos)}. ${porConfirmar ? 'Tocar para confirmar o valor.' : 'Tocar para editar ou apagar.'}`,
    onclick: () => {
      despesaAEditar = chave;
      modoDespesaAEditar = porConfirmar ? 'confirmar' : 'editar';
      fecharNovaDespesa();
      desenharDeNovo();
    },
  },
  criar('span', { className: 'gasto-data', textContent: `${data.getDate()} ${MESES_ABREVIADOS[data.getMonth()]}` }),
  criar('span', { className: 'gasto-texto' }, criar('span', { className: notaCartao ? 'gasto-detalhe gasto-detalhe-cartao' : 'gasto-detalhe' }, ...detalhe),
    ...(doFixo ? [criar('span', { className: porConfirmar ? 'gasto-marca gasto-fixo-por-confirmar' : 'gasto-marca', textContent: doFixo })] : []),
    ...(marca ? [criar('span', { className: 'gasto-marca', textContent: marca })] : [])),
  criar('span', { className: 'gasto-valor', textContent: formatarEuros(item.centimos) })));
  li.dataset.gasto = chave;
  return li;
}

// --- Gasto fixo por confirmar: "Valor deste mês", Confirmar, Editar e Apagar ---
// Abre por baixo do gasto (no lugar dele): por cima, a linha do gasto, que fecha o painel ao tocar. Confirmar grava o
// valor (se mudou) e tira a marca porConfirmar; o valor habitual do gasto fixo não muda. Apagar deixa a marca em
// dados.fixosCriados: o gasto deste mês não volta a ser criado. Enter confirma e Esc fecha.
function painelConfirmarFixo(item, desenharDeNovo) {
  const chave = `${item.origem}:${item.id}`;
  const n = ++contadorFormularios;
  const data = textoParaData(item.data);
  const fechar = () => { despesaAEditar = null; desenharDeNovo(); };
  const topo = criar('button', {
    type: 'button',
    className: 'gasto-linha gasto-linha-por-confirmar gasto-confirmar-topo',
    'aria-expanded': 'true',
    'aria-label': `${formatarData(data, { day: 'numeric', month: 'long' })}, ${item.nota || 'Sem nota'}, gasto fixo por confirmar, ${formatarEuros(item.centimos)}. Tocar para fechar.`,
    onclick: fechar,
  },
  criar('span', { className: 'gasto-data', textContent: `${data.getDate()} ${MESES_ABREVIADOS[data.getMonth()]}` }),
  criar('span', { className: 'gasto-texto' },
    criar('span', { className: 'gasto-detalhe' }, criar('span', { className: item.nota ? 'gasto-nota-texto' : 'gasto-sem-nota', textContent: item.nota || 'Sem nota' })),
    criar('span', { className: 'gasto-marca gasto-fixo-por-confirmar', textContent: 'Fixo · por confirmar' })),
  criar('span', { className: 'gasto-valor', textContent: formatarEuros(item.centimos) }));

  const idValor = `confirmar-valor-${n}`;
  const erro = criar('p', { id: `${idValor}-erro`, className: 'erro-campo', hidden: true });
  const valor = criar('input', {
    id: idValor, type: 'text', inputMode: 'decimal', autocomplete: 'off', enterKeyHint: 'done', placeholder: '0,00',
    value: valoresAConfirmar.has(chave) ? valoresAConfirmar.get(chave) : valorParaCampo(item.centimos),
    'aria-describedby': `${idValor}-erro`,
  });
  valor.addEventListener('input', () => {
    valoresAConfirmar.set(chave, valor.value);
    erro.hidden = true;
    valor.removeAttribute('aria-invalid');
  });
  const confirmar = criar('button', { type: 'submit', className: 'botao-pequeno botao-pequeno-principal', textContent: 'Confirmar' });
  const formulario = criar('form', { className: 'formulario-edicao', noValidate: true },
    criar('label', { htmlFor: idValor, textContent: 'Valor deste mês (€)' }),
    valor,
    erro,
    criar('div', { className: 'edicao-botoes' },
      confirmar,
      criar('button', {
        type: 'button',
        className: 'botao-pequeno',
        textContent: 'Editar',
        onclick: () => { modoDespesaAEditar = 'editar'; desenharDeNovo(); },
      }),
      criar('button', {
        type: 'button',
        className: 'botao-apagar-texto',
        textContent: 'Apagar',
        onclick: () => {
          if (!confirm(`Apagar o gasto de ${formatarEuros(item.centimos)} (${item.nota || nomeCategoriaDespesa(item.categoria)})? Este mês não volta a ser criado.`)) return;
          if (!apagarRegisto(item)) return;
          valoresAConfirmar.delete(chave);
          despesaAEditar = null;
          desenharDeNovo();
          avisar('Gasto apagado.');
        },
      })));
  formulario.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape') return;
    evento.preventDefault();
    fechar();
  });
  formulario.addEventListener('focusin', () => setTimeout(() => manterVisivel(confirmar), 350));
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const lido = lerValor(valor.value);
    if (lido.erro) {
      erro.textContent = lido.erro;
      erro.hidden = false;
      valor.setAttribute('aria-invalid', 'true');
      valor.focus();
      return;
    }
    const mudou = lido.centimos !== item.centimos;
    if (!alterarRegisto(item, { centimos: lido.centimos, porConfirmar: undefined })) return;
    valoresAConfirmar.delete(chave);
    despesaAEditar = null;
    gastosADestacar = [chave];
    desenharDeNovo();
    avisar(`Confirmado: ${formatarEuros(lido.centimos)}${item.nota ? ` (${item.nota})` : ''}.${mudou ? '' : ' O valor ficou igual.'}`);
  });
  const li = criar('li', { className: 'gasto-editar gasto-confirmar' }, topo, formulario);
  li.dataset.gasto = chave;
  return li;
}

// --- Preferência antiga da lista recolhível ---
// Até 21 nov 2026 (v45), a lista "Gastos do mês" podia recolher-se aos 4 mais recentes. Desde que a lista se agrupa
// por categoria, a escolha já não se usa no ecrã, mas a chave continua guardada e a ir e vir na cópia de segurança
// ("preferencias.gastosRecolhidos", ver ajustes.js), para as cópias antigas e novas continuarem compatíveis.
const CHAVE_GASTOS_RECOLHIDOS = 'organizador-gastos-recolhidos';

function guardarGastosRecolhidos(recolhidos) {
  try {
    localStorage.setItem(CHAVE_GASTOS_RECOLHIDOS, recolhidos ? 'sim' : 'nao');
  } catch (erro) { /* sem espaço: fica a escolha deste aparelho */ }
}

// --- "Gastos do mês": "Por categorizar" e os blocos Casa e Pessoal, agrupados por categoria ---
// Categorias abertas, só enquanto a app estiver aberta: ao abrir a app começa tudo fechado. Guardadas por bloco e por
// categoria ("casa|id", "pessoal|id" ou "por-categorizar|id"), porque uma categoria pode estar nos dois blocos (com
// gastos marcados à parte). Mantêm-se ao mudar de período e de pessoa; as de categorias apagadas são esquecidas.
const categoriasAbertas = new Set();
// Gastos acabados de registar, editar ou importar ("despesa:id" ou "compras:id"): a categoria deles abre (no bloco
// certo) e o primeiro que aparecer na lista fica à vista, com um realce breve. Só vale para o desenho seguinte da lista
// na vista Gastos.
let gastosADestacar = [];

const BLOCOS_GASTOS = [
  { tipo: 'casa', titulo: 'Casa' },
  { tipo: 'pessoal', titulo: 'Pessoal' },
];

function chaveAberta(bloco, id) {
  return `${bloco}|${id}`;
}

function ePorCategorizar(id) {
  return chaveTexto(nomeCategoriaDespesa(id)) === chaveTexto(CATEGORIA_POR_CATEGORIZAR);
}

// Grupos { id, nome, gastos, total }: só as categorias com gastos. "Por categorizar" primeiro; depois do maior total
// para o menor; com o mesmo total, por ordem alfabética (sem maiúsculas nem acentos). "lista" já vem ordenada por data.
function gruposPorCategoria(lista) {
  const porId = new Map();
  lista.forEach((g) => {
    if (!porId.has(g.categoria)) porId.set(g.categoria, []);
    porId.get(g.categoria).push(g);
  });
  return [...porId].map(([id, gastosDela]) => ({ id, nome: nomeCategoriaDespesa(id), gastos: gastosDela, total: somaCentimos(gastosDela) }))
    .sort((a, b) => Number(ePorCategorizar(b.id)) - Number(ePorCategorizar(a.id))
      || b.total - a.total
      || a.nome.localeCompare(b.nome, 'pt-PT', { sensitivity: 'base' }));
}

// Somas por bloco de uma lista (itens de todosOsGastos): { casa, pessoal, porCategorizar } em cêntimos.
function somasPorBloco(lista) {
  const somas = { casa: 0, pessoal: 0, porCategorizar: 0 };
  lista.forEach((g) => {
    const bloco = blocoDoGasto(g);
    if (bloco === 'por-categorizar') somas.porCategorizar += g.centimos;
    else somas[bloco] += g.centimos;
  });
  return somas;
}

// Ícones de traço dos blocos: uma casa (cor de destaque) e uma pessoa (cor de acento própria, ver style.css).
const ICONES_BLOCOS = {
  casa: ['M3.5 11 12 4l8.5 7', 'M6 9.5V20h12V9.5', 'M10 20v-5h4v5'],
  pessoal: ['M12 4.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7z', 'M5 20c.7-3.6 3.6-5.8 7-5.8s6.3 2.2 7 5.8'],
};
function iconeBloco(tipo) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', `icone-bloco icone-bloco-${tipo}`);
  ICONES_BLOCOS[tipo].forEach((d) => {
    const caminho = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    caminho.setAttribute('d', d);
    svg.append(caminho);
  });
  return svg;
}

// Leva o gasto até à vista (scroll suave, sem animação se o sistema pedir menos movimento) e realça-o durante 1 s.
const MENOS_MOVIMENTO = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
function mostrarGastosDestacados(caixa, chaves) {
  const linhas = chaves.map((chave) => caixa.querySelector(`[data-gasto="${CSS.escape(chave)}"]`)).filter(Boolean);
  if (!linhas.length) return;
  // Depois de mostrarVista, que volta ao topo da página.
  setTimeout(() => {
    const primeira = linhas.filter((l) => l.isConnected)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))[0];
    if (!primeira) return;
    primeira.scrollIntoView({ behavior: MENOS_MOVIMENTO.matches ? 'auto' : 'smooth', block: 'center' });
    linhas.forEach((l) => l.classList.add('gasto-realce'));
    setTimeout(() => linhas.forEach((l) => l.classList.remove('gasto-realce')), 1000);
  }, 60);
}

// Barra fixa no fundo da vista: o nome do período e o total do que está escolhido no seletor (mercearia e gastos
// gerais). O ano só aparece quando não é o atual. Por baixo do total, "Casa … · Pessoal …" (só as partes com valor;
// "Por categorizar" conta no total, mas em nenhuma delas). "totalJuntos" (o dos dois juntos) só aparece, ainda por baixo,
// com o seletor visível e uma escolha que não seja "Juntos"; null esconde-o.
function desenharTotalMes(periodo, total, somas, totalJuntos = null) {
  const nome = primeiraMaiuscula(NOMES_MESES[periodo.mes]);
  document.getElementById('gastos-total-mes').textContent =
    periodo.ano === new Date().getFullYear() ? nome : `${nome} ${periodo.ano}`; // na barra, sem "de", para caber
  document.getElementById('gastos-total-valor').textContent = formatarEuros(total);
  const partes = BLOCOS_GASTOS.filter((b) => somas[b.tipo] > 0)
    .map((b) => criar('span', { className: 'gastos-total-parte', textContent: `${b.titulo} ${formatarEuros(somas[b.tipo])}` }));
  const blocos = document.getElementById('gastos-total-blocos');
  blocos.replaceChildren(...partes.flatMap((parte, i) => (i ? [criar('span', { className: 'gastos-total-ponto', textContent: ' · ' }), parte] : [parte])));
  blocos.hidden = partes.length === 0;
  const juntos = document.getElementById('gastos-total-casa');
  juntos.textContent = totalJuntos === null ? '' : `Juntos: ${formatarEuros(totalJuntos)}`;
  juntos.hidden = totalJuntos === null;
  desenharPrevisto(periodo, total);
}

// "Previsto: 1450,00 €", à esquerda, por cima do nome do período: o total de agora mais os gastos fixos que ainda vão
// entrar neste período (centimosFixosEmFalta, em fixos.js). Só no período de hoje ou num futuro, só se faltar algum e
// só com "Meus" ou "Juntos" (os fixos são sempre meus). É só uma conta para o ecrã: nada é gravado.
function desenharPrevisto(periodo, total) {
  const caixa = document.getElementById('gastos-total-previsto');
  const emFalta = periodo.fim >= dataParaTexto(new Date()) && (escolhaPessoas === 'meus' || escolhaPessoas === 'casa')
    && typeof centimosFixosEmFalta === 'function' ? centimosFixosEmFalta(periodo) : 0;
  if (emFalta <= 0) {
    caixa.replaceChildren();
    caixa.hidden = true;
    return;
  }
  const valor = formatarEuros(total + emFalta);
  // O leitor de ecrã lê a frase inteira; o texto à vista é mais curto. Se não couber, o valor passa para baixo.
  caixa.replaceChildren(
    criar('span', { className: 'so-leitor', textContent: `Previsto até ao fim do período: ${valor}` }),
    criar('span', { 'aria-hidden': 'true', textContent: 'Previsto:' }),
    document.createTextNode(' '),
    criar('span', { 'aria-hidden': 'true', textContent: valor }));
  caixa.hidden = false;
}

// A barra do total muda de altura (com as linhas de baixo): a vista e os avisos acompanham-na (--altura-barra-total,
// ver style.css). Só se mede quando se vê (escondida, mede 0).
const barraTotal = document.getElementById('gastos-total-barra');
if (window.ResizeObserver) {
  new ResizeObserver(() => {
    const altura = barraTotal.offsetHeight;
    if (altura) document.documentElement.style.setProperty('--altura-barra-total', `${altura}px`);
  }).observe(barraTotal);
}

// Lista do período (ver mes.js): os registos com data entre o início e o fim, incluídos. Com o seletor de pessoas
// visível, só os gastos da escolha (ver gastosDaEscolha). De cima para baixo: "Por categorizar" (fora dos blocos) e os
// blocos Casa e Pessoal, cada um com as suas categorias; um bloco sem gastos não aparece.
function desenharDespesasMes(periodo) {
  const comPessoas = desenharSeletorPessoas();
  const doPeriodo = todosOsGastos().filter((g) => g.data >= periodo.inicio && g.data <= periodo.fim);
  const doMes = gastosDaEscolha(doPeriodo)
    // Do mais recente para o mais antigo; no mesmo dia, o último registado primeiro (os ids começam pela hora).
    .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
  const redesenhar = () => desenharDespesasMes(periodo);
  const chaveDe = (g) => `${g.origem}:${g.id}`;

  // As categorias apagadas deixam de contar como abertas.
  [...categoriasAbertas].forEach((chave) => {
    const id = chave.slice(chave.indexOf('|') + 1);
    if (!categoriasDespesas.some((c) => c.id === id)) categoriasAbertas.delete(chave);
  });
  // Um gasto acabado de registar, editar ou importar abre a sua categoria, no bloco dele (só quando a vista Gastos se
  // vê: depois de "Registar compras", na Mercearia, espera pela entrada nos Gastos).
  let destacados = [];
  if (vistaAtual === 'gastos' && gastosADestacar.length) {
    destacados = gastosADestacar;
    gastosADestacar = [];
    doMes.forEach((g) => { if (destacados.includes(chaveDe(g))) categoriasAbertas.add(chaveAberta(blocoDoGasto(g), g.categoria)); });
  }

  // Secções: "Por categorizar" (sem título) e os blocos com gastos, cada uma com os seus grupos.
  const seccoes = [
    { bloco: 'por-categorizar', grupos: gruposPorCategoria(doMes.filter((g) => blocoDoGasto(g) === 'por-categorizar')) },
    ...BLOCOS_GASTOS.map((b) => ({ bloco: b.tipo, titulo: b.titulo, grupos: gruposPorCategoria(doMes.filter((g) => blocoDoGasto(g) === b.tipo)) })),
  ].filter((seccao) => seccao.grupos.length);
  // Um gasto aberto para editar que deixou de se ver (categoria fechada ou fora da lista) é fechado, sem guardar.
  if (despesaAEditar && !seccoes.some((seccao) => seccao.grupos.some((gr) => categoriasAbertas.has(chaveAberta(seccao.bloco, gr.id))
    && gr.gastos.some((g) => chaveDe(g) === despesaAEditar)))) {
    despesaAEditar = null;
  }

  const caixa = document.getElementById('mes-gastos');
  caixa.dataset.mes = periodo.chave;
  const linhaGrupo = (bloco, grupo) => {
    const chave = chaveAberta(bloco, grupo.id);
    const aberta = categoriasAbertas.has(chave);
    const porCategorizar = bloco === 'por-categorizar';
    const n = grupo.gastos.length;
    // No bloco que não é o da categoria (gastos marcados à parte), diz de onde vêm.
    const daCategoria = tipoDaCategoria(grupo.id);
    const aParte = !porCategorizar && daCategoria !== bloco
      ? ` · ${daCategoria === 'pessoal' ? 'pessoal' : 'da casa'}, ${n === 1 ? 'marcado' : 'marcados'} como ${bloco === 'pessoal' ? 'Pessoal' : 'da casa'}`
      : '';
    const contagem = `${n} ${n === 1 ? 'gasto' : 'gastos'}${porCategorizar ? ' · toca para arrumar' : aParte}`;
    const idLista = `gastos-grupo-${bloco}-${grupo.id}`.replace(/[^\w-]/g, '_');
    const botao = criar('button', {
      type: 'button',
      className: 'gastos-grupo-linha',
      'aria-expanded': String(aberta),
      'aria-controls': idLista,
      onclick: () => {
        if (aberta) categoriasAbertas.delete(chave);
        else categoriasAbertas.add(chave);
        redesenhar();
        // O foco fica no botão da mesma categoria, no mesmo bloco (a lista foi desenhada outra vez).
        const mesmo = [...caixa.querySelectorAll('.gastos-grupo-linha')].find((b) => b.dataset.chave === chave);
        if (mesmo) mesmo.focus({ preventScroll: true });
      },
    },
    criar('span', { className: 'gastos-grupo-texto' },
      criar('span', { className: 'gastos-grupo-nome', textContent: grupo.nome }),
      // Com a explicação dos marcados à parte, o texto pode passar para a linha seguinte (não se corta).
      criar('span', { className: aParte ? 'gastos-grupo-contagem gastos-grupo-contagem-a-parte' : 'gastos-grupo-contagem', textContent: contagem })),
    criar('span', { className: 'gastos-grupo-total', textContent: formatarEuros(grupo.total) }),
    criar('span', { className: 'botao-linha-seta', 'aria-hidden': 'true', textContent: '›' }));
    botao.dataset.categoria = grupo.id;
    botao.dataset.chave = chave;
    return criar('li', { className: porCategorizar ? 'gastos-grupo gastos-grupo-por-categorizar' : 'gastos-grupo' },
      botao,
      criar('ul', { className: 'gastos-lista gastos-grupo-lista', id: idLista, hidden: !aberta },
        ...(aberta ? grupo.gastos.map((g) => linhaDespesa(g, redesenhar)) : [])));
  };
  // Gastos fixos por confirmar no período e na escolha mostrados: uma linha âmbar no topo, antes de "Por categorizar".
  // Tocar abre as categorias deles e leva ao primeiro.
  const aConfirmar = doMes.filter((g) => g.origem === 'despesa' && g.registo.porConfirmar === true);
  const linhaPorConfirmar = aConfirmar.length ? [criar('button', {
    type: 'button',
    className: 'fixos-por-confirmar',
    'aria-label': `${aConfirmar.length} ${aConfirmar.length === 1 ? 'gasto fixo por confirmar' : 'gastos fixos por confirmar'}. Ver.`,
    onclick: () => {
      gastosADestacar = aConfirmar.map(chaveDe);
      redesenhar();
    },
  },
  criar('span', { className: 'fixos-por-confirmar-texto', textContent: `${aConfirmar.length} ${aConfirmar.length === 1 ? 'gasto fixo por confirmar' : 'gastos fixos por confirmar'}` }),
  criar('span', { className: 'fixos-por-confirmar-ver', 'aria-hidden': 'true', textContent: 'Ver ›' }))] : [];
  if (seccoes.length) {
    caixa.replaceChildren(...linhaPorConfirmar, ...seccoes.map((seccao) => {
      const lista = criar('ul', { className: 'gastos-grupos' }, ...seccao.grupos.map((grupo) => linhaGrupo(seccao.bloco, grupo)));
      if (seccao.bloco === 'por-categorizar') return lista;
      const idTitulo = `gastos-bloco-${seccao.bloco}-titulo`;
      const subtotal = somaCentimos(seccao.grupos.flatMap((gr) => gr.gastos));
      return criar('section', { className: `gastos-bloco gastos-bloco-${seccao.bloco}`, 'aria-labelledby': idTitulo },
        criar('h3', { className: 'gastos-bloco-titulo', id: idTitulo },
          iconeBloco(seccao.bloco),
          criar('span', { className: 'gastos-bloco-nome', textContent: seccao.titulo }),
          criar('span', { className: 'gastos-bloco-total', textContent: formatarEuros(subtotal) })),
        lista);
    }));
  } else {
    caixa.replaceChildren(criar('p', { className: 'mes-vazio-curto', textContent: `Sem gastos em ${NOMES_MESES[periodo.mes]}.` }));
  }
  if (destacados.length) mostrarGastosDestacados(caixa, destacados);
  // O total é sempre de todos os gastos do período (da escolha), com as categorias abertas ou fechadas.
  desenharTotalMes(periodo, somaCentimos(doMes), somasPorBloco(doMes), comPessoas && escolhaPessoas !== 'casa' ? somaCentimos(doPeriodo) : null);
  // Com um gasto aberto para editar, o "voltar" do Android fecha-o (sem guardar), como o Cancelar.
  if (despesaAEditar) abrirComVoltar('editar-gasto', 'gastos', () => { despesaAEditar = null; redesenhar(); });
  else fechadoSemVoltar('editar-gasto');
}

// --- Categorias de gastos ---
const estadoCategoriasDespesas = { aRenomear: null };

// Só a gestão: nome e lápis (os totais estão em "Gastos do mês"). As pessoais têm a etiqueta "Pessoal".
function itensCategoriasDespesas() {
  return categoriasDespesasOrdenadas().map((c) => ({
    chave: c.id,
    nome: c.nome,
    podeRenomear: true,
    podeApagar: !CATEGORIAS_FIXAS.includes(c.id),
    ...(tipoDaCategoria(c.id) === 'pessoal' ? { etiqueta: 'Pessoal' } : {}),
  }));
}

// No cartão do lápis, por baixo do nome: "Os gastos desta categoria são" "Da casa" / "Pessoais". "Por categorizar"
// não tem tipo (aparece sempre à parte), por isso não tem o controlo.
function campoTipoCategoria(item) {
  const tipo = tipoDaCategoria(item.chave);
  if (tipo === null) return null;
  return escolhaDeDuas({
    id: 'despesas-categoria-tipo',
    rotulo: 'Os gastos desta categoria são',
    opcoes: [['casa', 'Da casa'], ['pessoal', 'Pessoais']],
    valor: tipo,
  });
}

function aposMudarCategorias() {
  correrSemFalhar(() => desenharDespesasMes(periodoDoDeslocamento(mesDeslocamento)));
  correrSemFalhar(desenharComerciantes);
  // Os gastos fixos mostram o nome da categoria; um cartão aberto tem a lista antiga e fecha-se (fixos.js).
  if (typeof aposMudarCategoriasFixos === 'function') correrSemFalhar(aposMudarCategoriasFixos);
  // Um formulário aberto tem a lista de categorias antiga: fecha-se, sem perder nada já guardado.
  fecharNovaDespesa();
}

function criarCategoriaDespesa(nome) {
  // As novas ficam guardadas no fim da lista, antes de Outros (no ecrã aparecem por ordem alfabética).
  // Uma nova começa como "Da casa".
  categoriasDespesas = [...categoriasDespesas.slice(0, -1), { id: novoId(), nome, tipo: 'casa' }, categoriasDespesas[categoriasDespesas.length - 1]];
  if (!guardarCategoriasDespesas()) {
    categoriasDespesas = categoriasDespesas.filter((c) => c.nome !== nome);
    return 'Não foi possível guardar.';
  }
  aposMudarCategorias();
  return null;
}

// Os gastos guardam o id da categoria: renomear não mexe em nenhum gasto. O tipo ("casa" ou "pessoal") grava-se com o
// nome; os gastos sem marca própria seguem-no logo, em todos os períodos (nenhum gasto é alterado).
function renomearCategoriaDespesa(id, nome, tipo) {
  const categoria = categoriasDespesas.find((c) => c.id === id);
  if (!categoria) return 'Esta categoria já não existe.';
  const antigo = { ...categoria };
  const tipoAntes = tipoDaCategoria(id);
  const mudaTipo = TIPOS_GASTO.includes(tipo) && tipoAntes !== null && tipo !== tipoAntes;
  if (antigo.nome === nome && !mudaTipo) return null; // nada mudou: só fecha
  categoria.nome = nome;
  if (mudaTipo) categoria.tipo = tipo;
  if (!guardarCategoriasDespesas()) {
    Object.keys(categoria).forEach((campo) => { if (!(campo in antigo)) delete categoria[campo]; });
    Object.assign(categoria, antigo);
    return 'Não foi possível guardar.';
  }
  aposMudarCategorias();
  const avisos = [];
  if (antigo.nome !== nome) avisos.push(`Categoria "${antigo.nome}" passou a "${nome}".`);
  if (mudaTipo) avisos.push(`Os gastos de "${nome}" passaram a ${tipo === 'pessoal' ? 'pessoais' : 'da casa'}.`);
  avisar(avisos.join(' '));
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
    // Conta os gastos de todos os períodos: são todos esses que passam para Outros.
    const texto = afetados.length === 1
      ? 'tem 1 gasto no total (todos os períodos), que passa'
      : `tem ${afetados.length} gastos no total (todos os períodos), que passam`;
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
    vista: 'gastos',
    aoCriar: criarCategoriaDespesa,
    aoRenomear: renomearCategoriaDespesa,
    aoApagar: apagarCategoriaDespesa,
    campoExtra: campoTipoCategoria,
  });
}

// "Comerciantes lembrados": sub-secção recolhível dentro de "Categorias de gastos", recolhida por defeito.
const botaoComerciantes = document.getElementById('despesas-comerciantes-abrir');
function definirComerciantesAbertos(abertos) {
  document.getElementById('despesas-comerciantes').hidden = !abertos;
  botaoComerciantes.setAttribute('aria-expanded', String(abertos));
  if (abertos) {
    desenharComerciantes();
    mostrarAcimaDasBarras(document.getElementById('despesas-comerciantes'));
  } else {
    // Um comerciante aberto para editar fecha-se sem guardar.
    regraAEditar = null;
    fechadoSemVoltar('editar-comerciante');
  }
}
botaoComerciantes.addEventListener('click', () => {
  definirComerciantesAbertos(botaoComerciantes.getAttribute('aria-expanded') !== 'true');
});

document.getElementById('despesas-categorias-caixa').addEventListener('toggle', (evento) => {
  if (evento.target.open) {
    desenharCategoriasDespesas();
    // Está no fim da vista Gastos: ao abrir, a página desliza para a mostrar inteira acima da barra do total.
    mostrarAcimaDasBarras(evento.target);
  } else {
    estadoCategoriasDespesas.aRenomear = null;
    fechadoSemVoltar('renomear-despesas-categoria');
    // Ao fechar "Categorias de gastos", os comerciantes voltam a ficar recolhidos.
    definirComerciantesAbertos(false);
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

// A mensagem fica por baixo dos botões CSV, na caixa partilhada do topo dos Gastos.
function mostrarResultadoCartao(texto) {
  mostrarResultadoGastos(texto);
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

  // Comerciantes já lembrados entram com a sua categoria (e o nome a mostrar, se houver); os novos e os que estão em
  // "perguntar sempre", em "Por categorizar".
  const comRegra = novas.map((linha) => ({ linha, regra: linha.comerciante ? regraAplicavel(linha.comerciante) : null }));
  const lembrados = comRegra.filter((n) => n.regra).length;
  if (novas.length > 0) {
    const porCategorizar = lembrados < novas.length ? garantirCategoriaPorCategorizar() : null;
    if (lembrados < novas.length && !porCategorizar) return; // já foi avisado de que não deu para guardar
    // "Categorias de gastos" passa a mostrar "Por categorizar", se acabou de ser criada.
    if (porCategorizar) correrSemFalhar(desenharCategoriasDespesas);
    const antes = despesas;
    const idsNovos = comRegra.map(() => novoId());
    despesas = [...despesas, ...comRegra.map(({ linha, regra }, i) => ({
      id: idsNovos[i],
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
    // Leva o seletor para o período do gasto novo mais recente, para se ver logo na lista (que abre, se algum dos
    // gastos novos desse período ficar escondido).
    gastosADestacar = idsNovos.map((id) => `despesa:${id}`);
    mesDeslocamento = deslocamentoDaData(novas.map((linha) => linha.data).sort().pop());
    despesaAEditar = null;
    fecharNovaDespesa();
    desenharMes();
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
