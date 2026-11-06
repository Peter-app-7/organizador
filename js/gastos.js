// gastos.js: registo do que se gasta em cada ida às compras. Formulário na vista Compras e histórico na vista Mês.
// Os registos ficam numa chave própria do localStorage, à parte dos outros dados, e entram nas cópias de segurança.

const CHAVE_GASTOS = 'organizador-gastos';
const EUROS = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
const VALOR_MAXIMO = 9999999; // 99 999,99 €, em cêntimos

// Ex.: 1250 passa a "12,50 €".
function formatarEuros(centimos) {
  return EUROS.format(centimos / 100);
}

// Loja sem espaços a mais; a comparação também ignora maiúsculas e acentos.
function limparLoja(texto) {
  return texto.replace(/\s+/g, ' ').trim();
}

// Limpa registos vindos de fora (do aparelho ou de uma cópia). Os que não estiverem completos ficam de fora.
function normalizarGastos(lista) {
  if (!Array.isArray(lista)) return [];
  const ids = new Set();
  return lista
    .filter((g) => g && typeof g === 'object'
      && typeof g.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.data)
      && typeof g.loja === 'string' && limparLoja(g.loja)
      && Number.isInteger(g.centimos) && g.centimos > 0 && g.centimos <= VALOR_MAXIMO)
    .map((g) => {
      const id = typeof g.id === 'string' && g.id && !ids.has(g.id) ? g.id : novoId();
      ids.add(id);
      return { id, data: g.data, loja: primeiraMaiuscula(limparLoja(g.loja)), centimos: g.centimos };
    });
}

function carregarGastos() {
  let texto = null;
  try {
    texto = localStorage.getItem(CHAVE_GASTOS);
    if (!texto) return [];
    const bruto = JSON.parse(texto);
    return normalizarGastos(bruto.registos);
  } catch (erro) {
    // Ilegíveis: o original fica guardado à parte para não se perder ao gravar por cima.
    try {
      if (texto) localStorage.setItem(CHAVE_GASTOS + '-danificados', texto);
    } catch (erroAoGuardar) { /* sem espaço ou sem acesso */ }
    return [];
  }
}

let gastos = carregarGastos();

function guardarGastos() {
  try {
    localStorage.setItem(CHAVE_GASTOS, JSON.stringify({ versao: 1, registos: gastos }));
    return true;
  } catch (erro) {
    avisar('Não foi possível guardar. Exporta uma cópia de segurança.');
    return false;
  }
}

// Lojas já usadas, com a forma como foram escritas da primeira vez, por ordem alfabética.
function lojasUsadas() {
  const porChave = new Map();
  gastos.forEach((g) => { if (!porChave.has(chaveTexto(g.loja))) porChave.set(chaveTexto(g.loja), g.loja); });
  return [...porChave.values()].sort((a, b) => a.localeCompare(b, 'pt-PT', { sensitivity: 'base' }));
}

// Se a loja já existir (sem contar maiúsculas, acentos e espaços), usa o nome que já está guardado.
function nomeDaLoja(texto) {
  const limpa = limparLoja(texto);
  return lojasUsadas().find((loja) => chaveTexto(loja) === chaveTexto(limpa)) || primeiraMaiuscula(limpa);
}

// Devolve { centimos } ou { erro }. Aceita "12,5", "12.50" e "12 €"; nunca passa por números com vírgula flutuante.
function lerValor(texto) {
  const limpo = texto.replace(/€/g, '').replace(/\s+/g, '');
  if (!limpo) return { erro: 'Escreve o valor total.' };
  if (limpo.startsWith('-')) return { erro: 'O valor tem de ser maior do que 0.' };
  const partes = limpo.match(/^(\d+)(?:[.,](\d*))?$/);
  if (!partes) return { erro: 'Escreve só números, com vírgula ou ponto (ex.: 12,50).' };
  const decimais = partes[2] || '';
  if (decimais.length > 2) return { erro: 'Usa no máximo 2 casas decimais.' };
  const centimos = Number(partes[1]) * 100 + Number(decimais.padEnd(2, '0'));
  if (centimos <= 0) return { erro: 'O valor tem de ser maior do que 0.' };
  if (centimos > VALOR_MAXIMO) return { erro: 'O valor máximo é 99 999,99 €.' };
  return { centimos };
}

// Ex.: 1250 passa a "12,50", para pôr no campo ao editar.
function valorParaCampo(centimos) {
  return (centimos / 100).toFixed(2).replace('.', ',');
}

function dataValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  return dataParaTexto(textoParaData(texto)) === texto; // recusa, por exemplo, 31 de fevereiro
}

// Com o teclado aberto, o iPhone só garante que o campo fica visível: aqui, leva também o botão de guardar.
function manterVisivel(elemento) {
  const vista = window.visualViewport;
  if (!vista || !elemento.isConnected) return;
  const caixa = elemento.getBoundingClientRect();
  const fundo = vista.offsetTop + vista.height - 12;
  if (caixa.bottom > fundo) window.scrollBy(0, caixa.bottom - fundo);
}

let contadorFormularios = 0;

// Formulário de um registo, novo ou a editar. Os erros aparecem por baixo de cada campo, sem janelas do navegador.
function formularioGasto({ registo, aoGuardar, aoCancelar, aoApagar }) {
  const n = ++contadorFormularios;
  const campo = (id, etiqueta, entrada) => {
    entrada.id = `gasto-${id}-${n}`;
    entrada.setAttribute('aria-describedby', `gasto-${id}-${n}-erro`);
    const erro = criar('p', { id: `gasto-${id}-${n}-erro`, className: 'erro-campo', hidden: true });
    return { entrada, erro, rotulo: criar('label', { htmlFor: entrada.id }, etiqueta, entrada, erro) };
  };
  const data = campo('data', 'Data', criar('input', { type: 'date', value: registo ? registo.data : dataParaTexto(new Date()), required: true }));
  const listaLojas = criar('datalist', { id: `gasto-lojas-${n}` }, ...lojasUsadas().map((loja) => criar('option', { value: loja })));
  const loja = campo('loja', 'Loja', criar('input', {
    type: 'text', value: registo ? registo.loja : '', placeholder: 'Ex.: mercado', autocomplete: 'off', autocapitalize: 'words',
  }));
  loja.entrada.setAttribute('list', listaLojas.id);
  const valor = campo('valor', 'Valor total (€)', criar('input', {
    type: 'text', value: registo ? valorParaCampo(registo.centimos) : '', placeholder: '0,00', inputMode: 'decimal', autocomplete: 'off', enterKeyHint: 'done',
  }));
  const guardar = criar('button', { type: 'submit', className: 'botao-principal', textContent: registo ? 'Guardar alterações' : 'Guardar' });
  const botoes = [guardar, criar('button', { type: 'button', className: 'botao-secundario', textContent: 'Cancelar', onclick: aoCancelar })];
  if (aoApagar) botoes.push(criar('button', { type: 'button', className: 'botao-apagar-registo', textContent: 'Apagar registo', onclick: aoApagar }));

  const mostrarErro = (parte, mensagem) => {
    parte.erro.textContent = mensagem || '';
    parte.erro.hidden = !mensagem;
    if (mensagem) parte.entrada.setAttribute('aria-invalid', 'true');
    else parte.entrada.removeAttribute('aria-invalid');
  };

  const formulario = criar('form', { className: 'formulario formulario-gasto', noValidate: true },
    data.rotulo, loja.rotulo, listaLojas, valor.rotulo, ...botoes);
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const lido = lerValor(valor.entrada.value);
    const erros = [
      [data, dataValida(data.entrada.value) ? null : 'Escolhe uma data válida.'],
      [loja, limparLoja(loja.entrada.value) ? null : 'Escreve o nome da loja.'],
      [valor, lido.erro || null],
    ];
    erros.forEach(([parte, mensagem]) => mostrarErro(parte, mensagem));
    const primeiro = erros.find(([, mensagem]) => mensagem);
    if (primeiro) {
      primeiro[0].entrada.focus();
      return;
    }
    aoGuardar({ data: data.entrada.value, loja: nomeDaLoja(loja.entrada.value), centimos: lido.centimos });
  });
  // Ao corrigir um campo, o erro dele desaparece.
  [data, loja, valor].forEach((parte) => parte.entrada.addEventListener('input', () => mostrarErro(parte, null)));
  formulario.addEventListener('focusin', () => setTimeout(() => manterVisivel(guardar), 350));
  return formulario;
}

// Quando o teclado abre ou muda de altura, volta a mostrar o botão de guardar do formulário em uso.
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const ativo = document.activeElement;
    const formulario = ativo && ativo.closest && ativo.closest('.formulario-gasto');
    if (formulario) manterVisivel(formulario.querySelector('button[type="submit"]'));
  });
}

// --- Vista Compras: botão "Registar compras" ---
const caixaRegisto = document.getElementById('gastos-registo');
const botaoRegistar = document.getElementById('gastos-registar');

function fecharRegisto() {
  caixaRegisto.replaceChildren();
  caixaRegisto.hidden = true;
  botaoRegistar.setAttribute('aria-expanded', 'false');
}

function abrirRegisto() {
  caixaRegisto.replaceChildren(
    criar('h2', { textContent: 'Registar compras' }),
    formularioGasto({
      aoGuardar: (novo) => {
        gastos.push({ id: novoId(), ...novo });
        if (!guardarGastos()) {
          gastos.pop();
          return;
        }
        fecharRegisto();
        avisar(`Registado: ${formatarEuros(novo.centimos)} em ${novo.loja}. Vê o histórico no separador Mês.`);
      },
      aoCancelar: fecharRegisto,
    }),
  );
  caixaRegisto.hidden = false;
  botaoRegistar.setAttribute('aria-expanded', 'true');
}

botaoRegistar.addEventListener('click', () => {
  if (caixaRegisto.hidden) abrirRegisto();
  else fecharRegisto();
});

// --- Vista Mês: secção "Gastos em compras" ---
let gastoAEditar = null; // id do registo aberto para editar

function somaCentimos(lista) {
  return lista.reduce((soma, g) => soma + g.centimos, 0);
}

function linhaGasto(registo, desenharDeNovo) {
  if (registo.id === gastoAEditar) {
    return criar('li', { className: 'gasto-editar' }, formularioGasto({
      registo,
      aoGuardar: (alterado) => {
        const antigo = { ...registo };
        Object.assign(registo, alterado);
        if (!guardarGastos()) {
          Object.assign(registo, antigo);
          return;
        }
        gastoAEditar = null;
        desenharDeNovo();
        avisar('Registo alterado.');
      },
      aoCancelar: () => { gastoAEditar = null; desenharDeNovo(); },
      aoApagar: () => {
        if (!confirm(`Apagar o registo de ${formatarEuros(registo.centimos)} em ${registo.loja}?`)) return;
        const antes = gastos;
        gastos = gastos.filter((g) => g.id !== registo.id);
        if (!guardarGastos()) {
          gastos = antes;
          return;
        }
        gastoAEditar = null;
        desenharDeNovo();
        avisar('Registo apagado.');
      },
    }));
  }
  const data = textoParaData(registo.data);
  return criar('li', {}, criar('button', {
    type: 'button',
    className: 'gasto-linha',
    'aria-label': `${formatarData(data, { day: 'numeric', month: 'long' })}, ${registo.loja}, ${formatarEuros(registo.centimos)}. Tocar para editar ou apagar.`,
    onclick: () => { gastoAEditar = registo.id; desenharDeNovo(); },
  },
  criar('span', { className: 'gasto-data', textContent: `${data.getDate()} ${MESES_ABREVIADOS[data.getMonth()]}` }),
  criar('span', { className: 'gasto-loja', textContent: registo.loja }),
  criar('span', { className: 'gasto-valor', textContent: formatarEuros(registo.centimos) })));
}

function desenharGastosMes(mes) {
  const chave = chaveMes(mes);
  const doMes = gastos
    .filter((g) => g.data.startsWith(`${chave}-`))
    // Do mais recente para o mais antigo; no mesmo dia, o último registado primeiro.
    .map((g, i) => ({ g, i }))
    .sort((a, b) => b.g.data.localeCompare(a.g.data) || b.i - a.i)
    .map(({ g }) => g);
  const doAno = gastos.filter((g) => g.data.startsWith(`${mes.getFullYear()}-`));
  const total = somaCentimos(doMes);
  const redesenhar = () => desenharGastosMes(mes);

  const porLoja = new Map();
  doMes.forEach((g) => porLoja.set(g.loja, (porLoja.get(g.loja) || 0) + g.centimos));
  const lojas = [...porLoja.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-PT'));

  const partes = [
    criar('div', { className: 'mes-cartao gastos-total' },
      criar('p', { className: 'mes-valor', textContent: formatarEuros(total) }),
      criar('p', { className: 'mes-legenda', textContent: `gasto em ${NOMES_MESES[mes.getMonth()]} · ${doMes.length} ${doMes.length === 1 ? 'ida às compras' : 'idas às compras'}` }),
      ...(lojas.length ? [criar('ul', { className: 'gastos-lojas' }, ...lojas.map(([loja, centimos]) => criar('li', {},
        criar('span', { className: 'gasto-loja', textContent: loja }),
        criar('span', { className: 'gasto-valor', textContent: formatarEuros(centimos) }))))] : []),
      criar('p', { className: 'mes-pormenor', textContent: `Total de ${mes.getFullYear()}: ${formatarEuros(somaCentimos(doAno))}` })),
  ];
  if (doMes.length) {
    partes.push(criar('ul', { className: 'gastos-lista' }, ...doMes.map((g) => linhaGasto(g, redesenhar))));
  } else {
    partes.push(criar('div', { className: 'mes-vazio' },
      criar('p', { className: 'mes-vazio-titulo', textContent: `Sem compras registadas em ${NOMES_MESES[mes.getMonth()]}.` }),
      criar('p', { textContent: 'Usa "Registar compras" na vista Compras.' })));
  }
  const caixa = document.getElementById('mes-gastos');
  caixa.dataset.mes = chave;
  caixa.replaceChildren(...partes);
}
