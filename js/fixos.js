// fixos.js: "Gastos fixos" na vista Gastos, logo a seguir a "Categorias de gastos" (recolhida por defeito).
// Cada gasto fixo (prestação da casa, seguros, luz, subscrições…) tem nome, valor habitual, dia do mês, categoria, tipo
// (casa/pessoal, ou o da categoria) e se entra sozinho ou "por confirmar". No dia certo, a app cria um gasto geral normal
// (organizador-despesas) em "Gastos do mês", com fixoId, fixoMes e, nos que têm de ser confirmados, porConfirmar.
// Os valores e os nomes são escritos na app: nada disto vem no código.
//
// Chave organizador-gastos-fixos = { versao: 1, fixos: [{ id, nome, categoria, tipo?, centimos, dia, confirmar, inicio,
// fim, ativo }] }. Cada mês criado fica marcado em dados.fixosCriados ("idDoFixo|AAAA-MM"): nunca é criado duas vezes,
// nem depois de o gasto ser apagado ou de restaurar uma cópia.

const CHAVE_FIXOS = 'organizador-gastos-fixos';
const NOME_FIXO_MAXIMO = 60; // letras
const MESES_PARA_TRAS = 12; // "Começa em": de 1 ano para trás…
const MESES_PARA_A_FRENTE = 24; // …até 2 anos para a frente
const MESES_FIM_A_FRENTE = 60; // "Termina em": até 5 anos para a frente
const MESES_A_CRIAR_MAXIMO = 240; // segurança: nunca mais de 20 anos de uma vez
const eMesTexto = (t) => typeof t === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(t);

// --- Datas por mês ("AAAA-MM") ---
function mesDeData(texto) {
  return texto.slice(0, 7);
}

function somarMeses(mes, quantos) {
  const [ano, m] = mes.split('-').map(Number);
  const data = new Date(ano, m - 1 + quantos, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

// Data do gasto num mês: o dia do fixo ou, se o mês não o tiver (ex.: 31 em abril), o último dia do mês.
function dataDoFixoNoMes(dia, mes) {
  const [ano, m] = mes.split('-').map(Number);
  const ultimo = new Date(ano, m, 0).getDate();
  return `${mes}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`;
}

// Mês da próxima vez que o dia chega, hoje incluído (ex.: hoje 21 nov, dia 5 → dezembro; dia 21 → novembro).
function mesDaProximaVez(dia, hoje = dataParaTexto(new Date())) {
  const mes = mesDeData(hoje);
  return dataDoFixoNoMes(dia, mes) >= hoje ? mes : somarMeses(mes, 1);
}

// Ex.: "2027-03" passa a "março de 2027" (com maiúscula: "Março de 2027").
function nomeDoMes(mes, maiuscula = false) {
  const [ano, m] = mes.split('-').map(Number);
  const texto = `${NOMES_MESES[m - 1]} de ${ano}`;
  return maiuscula ? primeiraMaiuscula(texto) : texto;
}

// --- Dados ---
// Lista limpa: os incompletos (sem nome, valor ou dia) ficam de fora; uma categoria que já não exista passa a Outros.
// Lança um erro se não for uma lista.
function normalizarFixos(lista, categorias) {
  if (!Array.isArray(lista)) throw new Error('Formato desconhecido');
  const idsCategorias = new Set(categorias.map((c) => c.id));
  const ids = new Set();
  const mesAtual = mesDeData(dataParaTexto(new Date()));
  return lista
    .filter((f) => f && typeof f === 'object'
      && typeof f.nome === 'string' && f.nome.trim()
      && Number.isInteger(f.centimos) && f.centimos > 0 && f.centimos <= VALOR_MAXIMO
      && Number.isInteger(f.dia) && f.dia >= 1 && f.dia <= 31)
    .map((f) => {
      const id = typeof f.id === 'string' && f.id && !f.id.includes('|') && !ids.has(f.id) ? f.id : novoId();
      ids.add(id);
      const inicio = eMesTexto(f.inicio) ? f.inicio : mesAtual;
      return {
        id,
        nome: f.nome.replace(/\s+/g, ' ').trim().slice(0, NOME_FIXO_MAXIMO),
        categoria: idsCategorias.has(f.categoria) ? f.categoria : 'outros',
        ...(TIPOS_GASTO.includes(f.tipo) ? { tipo: f.tipo } : {}),
        centimos: f.centimos,
        dia: f.dia,
        confirmar: f.confirmar === true,
        inicio,
        fim: eMesTexto(f.fim) ? f.fim : null,
        ativo: f.ativo !== false,
      };
    });
}

let fixos = (() => {
  const guardados = lerChave(CHAVE_FIXOS, 'fixos'); // ilegível: o original fica em "…-danificados" (despesas.js)
  try {
    return normalizarFixos(guardados || [], categoriasDespesas);
  } catch (erro) {
    return [];
  }
})();

function guardarFixos() {
  return guardarChave(CHAVE_FIXOS, { versao: 1, fixos });
}

// Tipo efetivo de um fixo: o seu, se tiver, senão o da categoria (como os gastos).
function tipoDoFixo(f) {
  return f.tipo || tipoDaCategoria(f.categoria) || 'casa';
}

// Em vigor: ativo e ainda não acabou (o mês do fim ainda conta). Só estes entram no total "€/mês" do resumo.
function fixoEmVigor(f, mesAtual = mesDeData(dataParaTexto(new Date()))) {
  return f.ativo && (!f.fim || f.fim >= mesAtual);
}

// --- Criar os gastos no dia certo ---
// Para cada fixo ativo, cada mês desde o início até ao atual (e até ao fim, inclusive), com a data já chegada (hoje
// incluído) e sem marca em dados.fixosCriados nem num gasto (fixoId + fixoMes): cria um gasto geral. Primeiro grava os
// gastos e só depois as marcas. Devolve os gastos criados.
function criarGastosFixosDevidos() {
  const hoje = dataParaTexto(new Date());
  const mesAtual = mesDeData(hoje);
  const jaCriados = new Set(Object.keys(dados.fixosCriados));
  despesas.forEach((d) => { if (d.fixoId && d.fixoMes) jaCriados.add(`${d.fixoId}|${d.fixoMes}`); });
  const idsCategorias = new Set(categoriasDespesas.map((c) => c.id));
  const novos = [];
  fixos.forEach((f) => {
    if (!f.ativo) return;
    const ultimo = f.fim && f.fim < mesAtual ? f.fim : mesAtual;
    let mes = f.inicio;
    for (let i = 0; mes <= ultimo && i < MESES_A_CRIAR_MAXIMO; i += 1, mes = somarMeses(mes, 1)) {
      const data = dataDoFixoNoMes(f.dia, mes);
      const marca = `${f.id}|${mes}`;
      if (data > hoje || jaCriados.has(marca)) continue;
      jaCriados.add(marca);
      // Uma categoria que já não exista passa a Outros, como nos outros gastos.
      const categoria = idsCategorias.has(f.categoria) ? f.categoria : 'outros';
      // "tipo" só se o fixo tiver um tipo próprio diferente do da categoria (como no resto da app).
      const tipo = f.tipo && f.tipo !== tipoDaCategoria(categoria) ? f.tipo : null;
      novos.push({
        id: novoId(),
        data,
        categoria,
        centimos: f.centimos,
        nota: f.nome.slice(0, NOTA_MAXIMA),
        ...(tipo ? { tipo } : {}),
        fixoId: f.id,
        fixoMes: mes,
        ...(f.confirmar ? { porConfirmar: true } : {}),
      });
    }
  });
  if (novos.length === 0) return [];
  const antes = despesas;
  despesas = [...despesas, ...novos];
  if (!guardarDespesas()) {
    despesas = antes;
    return [];
  }
  novos.forEach((d) => { dados.fixosCriados[`${d.fixoId}|${d.fixoMes}`] = 1; });
  guardarDados();
  return novos;
}

// Mensagem por baixo dos botões CSV, como as outras. Ex.: "2 gastos fixos criados (1 por confirmar)."
function textoFixosCriados(novos) {
  const n = novos.length;
  const porConfirmar = novos.filter((d) => d.porConfirmar).length;
  return `${n} ${n === 1 ? 'gasto fixo criado' : 'gastos fixos criados'}${porConfirmar ? ` (${porConfirmar} por confirmar)` : ''}.`;
}

// Depois de guardar um fixo, de o retomar ou de colar uma lista: cria logo os meses devidos e leva o seletor até ao
// mais recente, com a sua categoria aberta.
function criarDevidosEMostrar() {
  const novos = criarGastosFixosDevidos();
  if (novos.length === 0) return 0;
  mostrarResultadoGastos(textoFixosCriados(novos));
  mostrarMeusSeForOutraPessoa();
  gastosADestacar = novos.map((d) => `despesa:${d.id}`);
  mesDeslocamento = deslocamentoDaData(novos.map((d) => d.data).sort().pop());
  despesaAEditar = null;
  return novos.length;
}

// Ao abrir a app, ao voltar a ela e à meia-noite (app.js corre o aoAbrir quando muda o dia).
aoAbrir.push(() => {
  const novos = criarGastosFixosDevidos();
  if (novos.length) mostrarResultadoGastos(textoFixosCriados(novos));
});

// --- Secção "Gastos fixos" ---
const botaoFixos = document.getElementById('fixos-abrir');
const corpoFixos = document.getElementById('fixos-corpo');
const listaFixos = document.getElementById('fixos-lista');
const caixaNovoFixo = document.getElementById('fixos-novo-caixa');
const botaoNovoFixo = document.getElementById('fixos-novo');
const botaoColarFixos = document.getElementById('fixos-colar-abrir');
const caixaColarFixos = document.getElementById('fixos-colar-caixa');

// Cartão aberto: null, "novo" ou o id do fixo a editar (só um de cada vez). O elemento fica guardado para não perder o
// que já se escreveu quando a secção é desenhada outra vez (ex.: ao voltar à app).
let fixoAEditar = null;
let cartaoFixo = null; // { chave, elemento }

function fixosOrdenados() {
  return [...fixos].sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, 'pt-PT', { sensitivity: 'base' }));
}

function desenharResumoFixos() {
  const emVigor = fixos.filter((f) => fixoEmVigor(f));
  document.getElementById('fixos-resumo').textContent = fixos.length
    ? `${emVigor.length} · ${formatarEuros(somaCentimos(emVigor))}/mês`
    : 'Nenhum';
}

function definirFixosAbertos(abertos) {
  corpoFixos.hidden = !abertos;
  botaoFixos.setAttribute('aria-expanded', String(abertos));
  if (!abertos) {
    fecharCartaoFixo();
    definirColarFixos(false);
  }
  desenharFixos();
  // Está no fim da vista Gastos: ao abrir, a página desliza para a mostrar inteira acima da barra do total.
  if (abertos) mostrarAcimaDasBarras(botaoFixos.closest('.gastos-fixos'));
}
botaoFixos.addEventListener('click', () => definirFixosAbertos(corpoFixos.hidden));

function fecharCartaoFixo() {
  fixoAEditar = null;
  cartaoFixo = null;
  botaoNovoFixo.setAttribute('aria-expanded', 'false');
  fechadoSemVoltar('editar-fixo');
}

function abrirCartaoFixo(chave) {
  definirColarFixos(false);
  fixoAEditar = chave;
  cartaoFixo = null;
  botaoNovoFixo.setAttribute('aria-expanded', String(chave === 'novo'));
  desenharFixos();
  abrirComVoltar('editar-fixo', 'gastos', () => { fecharCartaoFixo(); desenharFixos(); });
  // O cartão fica inteiro à vista, acima da barra do total; depois, o teclado abre no nome (e o "Guardar" fica visível).
  const campo = document.getElementById('fixo-nome');
  if (cartaoFixo) mostrarAcimaDasBarras(cartaoFixo.elemento);
  if (campo) setTimeout(() => campo.focus({ preventScroll: true }), 0);
}

botaoNovoFixo.addEventListener('click', () => {
  if (fixoAEditar === 'novo') {
    fecharCartaoFixo();
    desenharFixos();
  } else {
    abrirCartaoFixo('novo');
  }
});

function linhaFixo(f) {
  const mesAtual = mesDeData(dataParaTexto(new Date()));
  const detalhes = [criar('span', { textContent: `dia ${f.dia} · ${nomeCategoriaDespesa(f.categoria)}` })];
  const junta = (elemento) => detalhes.push(' · ', elemento);
  if (f.confirmar) junta(criar('span', { className: 'fixo-confirmar', textContent: 'confirmar valor' }));
  if (!f.ativo) junta(criar('span', { textContent: 'em pausa' }));
  else if (f.fim) junta(criar('span', { textContent: `${f.fim < mesAtual ? 'terminou' : 'termina'} em ${nomeDoMes(f.fim)}` }));
  if (tipoDoFixo(f) !== tipoDaCategoria(f.categoria)) junta(criar('span', { textContent: tipoDoFixo(f) === 'pessoal' ? 'pessoal' : 'da casa' }));
  return criar('li', { className: fixoEmVigor(f, mesAtual) ? 'fixo-linha' : 'fixo-linha fixo-parado' },
    criar('span', { className: 'fixo-texto' },
      criar('span', { className: 'fixo-nome', textContent: f.nome }),
      criar('span', { className: 'fixo-detalhe' }, ...detalhes)),
    criar('span', { className: 'fixo-valor', textContent: formatarEuros(f.centimos) }),
    botaoLapis(`Editar ${f.nome}`, () => abrirCartaoFixo(f.id)));
}

function desenharFixos() {
  desenharResumoFixos();
  if (corpoFixos.hidden) return;
  // Com alguém a escrever no cartão, não se mexe nele (ex.: a app voltou a ficar visível).
  if (cartaoFixo && cartaoFixo.elemento.contains(document.activeElement)) return;
  if (fixoAEditar !== null && fixoAEditar !== 'novo' && !fixos.some((f) => f.id === fixoAEditar)) fecharCartaoFixo();
  const cartao = () => {
    if (!cartaoFixo || cartaoFixo.chave !== fixoAEditar) {
      cartaoFixo = { chave: fixoAEditar, elemento: cartaoEdicaoFixo(fixoAEditar === 'novo' ? null : fixos.find((f) => f.id === fixoAEditar)) };
    }
    return cartaoFixo.elemento;
  };
  const linhas = fixosOrdenados().map((f) => (f.id === fixoAEditar ? cartao() : linhaFixo(f)));
  listaFixos.replaceChildren(...linhas);
  listaFixos.hidden = linhas.length === 0;
  document.getElementById('fixos-vazio').hidden = fixos.length > 0;
  if (fixoAEditar === 'novo') caixaNovoFixo.replaceChildren(cartao());
  else caixaNovoFixo.replaceChildren();
  caixaNovoFixo.hidden = fixoAEditar !== 'novo';
}

// Opções de um seletor de mês, de "de" a "ate" (incluídos), mais "extra" se ficar de fora (ex.: o mês já guardado).
function opcoesDeMeses(de, ate, extra) {
  const meses = [];
  for (let mes = de; mes <= ate; mes = somarMeses(mes, 1)) meses.push(mes);
  if (extra && !meses.includes(extra)) meses.push(extra);
  return meses.sort().map((mes) => criar('option', { value: mes, textContent: nomeDoMes(mes, true) }));
}

// Cartão de novo / editar, com o estilo do cartão do lápis. "f" é o fixo a editar ou null para um novo.
function cartaoEdicaoFixo(f) {
  const hoje = dataParaTexto(new Date());
  const mesAtual = mesDeData(hoje);
  const erros = [];
  const campo = (id, etiqueta, entrada) => {
    entrada.id = `fixo-${id}`;
    entrada.setAttribute('aria-describedby', `fixo-${id}-erro`);
    const erro = criar('p', { id: `fixo-${id}-erro`, className: 'erro-campo', hidden: true });
    entrada.addEventListener('input', () => { erro.hidden = true; entrada.removeAttribute('aria-invalid'); });
    entrada.addEventListener('change', () => { erro.hidden = true; entrada.removeAttribute('aria-invalid'); });
    const parte = { entrada, erro, rotulo: criar('label', { htmlFor: entrada.id, textContent: etiqueta }) };
    erros.push(parte);
    return parte;
  };
  const mostrarErro = (parte, mensagem) => {
    parte.erro.textContent = mensagem;
    parte.erro.hidden = false;
    parte.entrada.setAttribute('aria-invalid', 'true');
  };

  const nome = campo('nome', 'Nome', criar('input', {
    type: 'text', value: f ? f.nome : '', maxLength: NOME_FIXO_MAXIMO, autocomplete: 'off', autocapitalize: 'sentences', enterKeyHint: 'next', placeholder: 'Ex.: Seguro do carro',
  }));
  const valor = campo('valor', 'Valor habitual (€)', criar('input', {
    type: 'text', value: f ? valorParaCampo(f.centimos) : '', inputMode: 'decimal', autocomplete: 'off', enterKeyHint: 'next', placeholder: '0,00',
  }));
  const dia = campo('dia', 'Dia do mês', criar('input', {
    type: 'number', value: f ? String(f.dia) : '', min: '1', max: '31', step: '1', inputMode: 'numeric', enterKeyHint: 'done', placeholder: '1 a 31',
  }));
  // Categorias de gastos por ordem alfabética, "Outros" em último, sem "Por categorizar" (não tem tipo).
  const categorias = categoriasDespesasOrdenadas().filter((c) => !ePorCategorizar(c.id));
  const categoria = campo('categoria', 'Categoria', criar('select', {},
    ...categorias.map((c) => criar('option', { value: c.id, textContent: c.nome }))));
  categoria.entrada.value = f && categorias.some((c) => c.id === f.categoria) ? f.categoria : (f ? 'outros' : categorias[0].id);

  // "Da casa" / "Pessoal": começa no tipo do fixo (o seu ou o da categoria) e acompanha a categoria até ser tocado.
  let tipoTocado = Boolean(f && f.tipo);
  const tipo = escolhaDeDuas({
    id: 'fixo-tipo',
    rotulo: 'É um gasto',
    opcoes: [['casa', 'Da casa'], ['pessoal', 'Pessoal']],
    valor: f ? tipoDoFixo(f) : (tipoDaCategoria(categoria.entrada.value) || 'casa'),
    aoMudar: () => { tipoTocado = true; },
  });
  categoria.entrada.addEventListener('change', () => {
    if (!tipoTocado) tipo.definir(tipoDaCategoria(categoria.entrada.value) || 'casa');
  });

  // Interruptor "Confirmar o valor todos os meses" (role="switch", etiqueta de 44 px).
  const confirmar = criar('input', { id: 'fixo-confirmar', className: 'interruptor-caixa', type: 'checkbox', checked: Boolean(f && f.confirmar), 'aria-describedby': 'fixo-confirmar-nota' });
  confirmar.setAttribute('role', 'switch');
  const interruptor = criar('label', { className: 'interruptor interruptor-linha', htmlFor: 'fixo-confirmar' },
    criar('span', { textContent: 'Confirmar o valor todos os meses' }),
    criar('span', { className: 'interruptor-marca' }, confirmar, criar('span', { className: 'interruptor-trilho', 'aria-hidden': 'true' })));
  const notaConfirmar = criar('p', { id: 'fixo-confirmar-nota', className: 'nota nota-edicao', textContent: 'Para valores que mudam (luz, Euribor).' });

  // "Começa em": de 1 ano para trás até 2 anos para a frente; num novo, o mês da próxima vez que o dia chega (acompanha
  // o dia até se mexer neste campo). "Termina em": "Sem fim" ou um mês igual ou depois do início.
  const inicio = campo('inicio', 'Começa em', criar('select', {},
    ...opcoesDeMeses(somarMeses(mesAtual, -MESES_PARA_TRAS), somarMeses(mesAtual, MESES_PARA_A_FRENTE), f ? f.inicio : null)));
  inicio.entrada.value = f ? f.inicio : mesAtual;
  let inicioTocado = Boolean(f);
  inicio.entrada.addEventListener('change', () => { inicioTocado = true; });
  dia.entrada.addEventListener('input', () => {
    const n = Number(dia.entrada.value);
    if (inicioTocado || !Number.isInteger(n) || n < 1 || n > 31) return;
    inicio.entrada.value = mesDaProximaVez(n, hoje);
  });
  const fim = campo('fim', 'Termina em', criar('select', {},
    criar('option', { value: '', textContent: 'Sem fim' }),
    ...opcoesDeMeses(somarMeses(mesAtual, -MESES_PARA_TRAS), somarMeses(mesAtual, MESES_FIM_A_FRENTE), f ? f.fim : null)));
  fim.entrada.value = f && f.fim ? f.fim : '';

  const fecharCartao = () => { fecharCartaoFixo(); desenharFixos(); };
  const formulario = criar('form', { className: 'formulario-edicao formulario-fixo', noValidate: true },
    criar('h3', { className: 'despesas-registo-titulo', textContent: f ? 'Editar gasto fixo' : 'Novo gasto fixo' }),
    nome.rotulo, nome.entrada, nome.erro,
    criar('div', { className: 'fixo-valor-dia' },
      criar('div', {}, valor.rotulo, valor.entrada, valor.erro),
      criar('div', {}, dia.rotulo, dia.entrada, dia.erro)),
    categoria.rotulo, categoria.entrada, categoria.erro,
    tipo.elemento,
    interruptor,
    notaConfirmar,
    inicio.rotulo, inicio.entrada, inicio.erro,
    fim.rotulo, fim.entrada, fim.erro);
  formulario.append(botoesEdicao(formulario, { aoCancelar: fecharCartao }));
  if (f) {
    formulario.append(criar('div', { className: 'fixo-acoes' },
      criar('button', {
        type: 'button',
        className: 'botao-pequeno',
        textContent: f.ativo ? 'Pausar' : 'Retomar',
        onclick: () => pausarOuRetomarFixo(f.id),
      }),
      criar('button', { type: 'button', className: 'botao-apagar-texto', textContent: 'Apagar', onclick: () => apagarFixo(f.id) })));
  }
  // "Seguinte" no teclado passa ao campo seguinte; no dia, guarda.
  [[nome, valor], [valor, dia]].forEach(([de, para]) => {
    de.entrada.addEventListener('keydown', (evento) => {
      if (evento.key !== 'Enter') return;
      evento.preventDefault();
      para.entrada.focus();
    });
  });

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const nomeLimpo = primeiraMaiuscula(nome.entrada.value.replace(/\s+/g, ' ')).slice(0, NOME_FIXO_MAXIMO);
    const repetido = fixos.find((outro) => outro.id !== (f && f.id) && chaveTexto(outro.nome) === chaveTexto(nomeLimpo));
    const lido = lerValor(valor.entrada.value);
    const numeroDia = Number(dia.entrada.value);
    const diaValido = dia.entrada.value.trim() !== '' && Number.isInteger(numeroDia) && numeroDia >= 1 && numeroDia <= 31;
    const existe = categorias.some((c) => c.id === categoria.entrada.value);
    const fimEscolhido = fim.entrada.value || null;
    const lista = [
      [nome, !nomeLimpo ? 'Escreve o nome do gasto fixo.' : (repetido ? `Já existe o gasto fixo «${repetido.nome}».` : null)],
      [valor, lido.erro ? (lido.erro === 'Escreve o valor total.' ? 'Escreve o valor habitual.' : lido.erro) : null],
      [dia, diaValido ? null : 'Escolhe um dia de 1 a 31.'],
      [categoria, existe ? null : 'Escolhe uma categoria.'],
      [inicio, eMesTexto(inicio.entrada.value) ? null : 'Escolhe o mês do início.'],
      [fim, fimEscolhido && fimEscolhido < inicio.entrada.value ? 'Escolhe "Sem fim" ou um mês igual ou depois do início.' : null],
    ];
    lista.forEach(([parte, mensagem]) => { if (mensagem) mostrarErro(parte, mensagem); });
    const primeiro = lista.find(([, mensagem]) => mensagem);
    if (primeiro) {
      primeiro[0].entrada.focus();
      return;
    }
    // "tipo" só fica gravado se for diferente do da categoria (como nos gastos).
    const tipoEscolhido = tipo.valor() !== tipoDaCategoria(categoria.entrada.value) ? tipo.valor() : null;
    const novo = {
      id: f ? f.id : novoId(),
      nome: nomeLimpo,
      categoria: categoria.entrada.value,
      ...(tipoEscolhido ? { tipo: tipoEscolhido } : {}),
      centimos: lido.centimos,
      dia: numeroDia,
      confirmar: confirmar.checked,
      inicio: inicio.entrada.value,
      fim: fimEscolhido,
      ativo: f ? f.ativo : true,
    };
    const antes = fixos;
    fixos = f ? fixos.map((outro) => (outro.id === f.id ? novo : outro)) : [...fixos, novo];
    if (!guardarFixos()) {
      fixos = antes;
      return;
    }
    // Mudar um fixo não muda os gastos já criados; os meses que já estejam devidos são criados logo.
    fecharCartaoFixo();
    const criados = criarDevidosEMostrar();
    desenharMes();
    avisar(f ? `Gasto fixo "${novo.nome}" alterado.` : `Gasto fixo "${novo.nome}" guardado.${criados ? '' : ` O primeiro gasto entra a ${dataAbreviada(dataDoFixoNoMes(novo.dia, novo.inicio))}${novo.inicio.slice(0, 4) === hoje.slice(0, 4) ? '' : ` de ${novo.inicio.slice(0, 4)}`}.`}`);
  });
  return criar(f ? 'li' : 'div', { className: 'cartao-edicao cartao-fixo' }, formulario);
}

// Pausar: deixa de criar gastos. Retomar: volta a criar a partir deste mês (os meses em pausa não são criados depois);
// se o dia deste mês já chegou, cria-o logo.
function pausarOuRetomarFixo(id) {
  const f = fixos.find((outro) => outro.id === id);
  if (!f) return;
  const antes = { ...f };
  const mesAtual = mesDeData(dataParaTexto(new Date()));
  f.ativo = !f.ativo;
  if (f.ativo && f.inicio < mesAtual) f.inicio = mesAtual;
  if (!guardarFixos()) {
    Object.assign(f, antes);
    return;
  }
  fecharCartaoFixo();
  if (f.ativo) {
    criarDevidosEMostrar();
    desenharMes();
    avisar(`Gasto fixo "${f.nome}" retomado.`);
  } else {
    desenharFixos();
    avisar(`Gasto fixo "${f.nome}" em pausa: não cria gastos até o retomares.`);
  }
}

// Os gastos já criados ficam (e as marcas também: um fixo apagado nunca volta a criar nada).
function apagarFixo(id) {
  const f = fixos.find((outro) => outro.id === id);
  if (!f) return;
  if (!confirm(`Apagar o gasto fixo "${f.nome}"? Os gastos que já criou ficam em "Gastos do mês".`)) return;
  const antes = fixos;
  fixos = fixos.filter((outro) => outro.id !== id);
  if (!guardarFixos()) {
    fixos = antes;
    return;
  }
  fecharCartaoFixo();
  desenharFixos();
  avisar(`Gasto fixo "${f.nome}" apagado. Os gastos já criados ficam.`);
}

// Chamado por despesas.js quando as categorias de gastos mudam: os nomes acompanham; um cartão aberto fecha-se.
function aposMudarCategoriasFixos() {
  if (fixoAEditar !== null) fecharCartaoFixo();
  desenharFixos();
}

// --- Colar lista ---
// Uma linha por gasto fixo: Nome;Valor;Dia;Categoria;casa ou pessoal;sozinho ou confirmar e, opcional no fim,
// ;AAAA-MM do último mês. Mostra uma pré-visualização; só "Criar N gastos fixos" grava.
function definirColarFixos(aberta) {
  caixaColarFixos.hidden = !aberta;
  botaoColarFixos.setAttribute('aria-expanded', String(aberta));
  if (aberta) {
    abrirComVoltar('colar-fixos', 'gastos', () => definirColarFixos(false));
  } else {
    fechadoSemVoltar('colar-fixos');
    limparPreviaFixos();
  }
}

botaoColarFixos.addEventListener('click', () => {
  if (caixaColarFixos.hidden) {
    if (fixoAEditar !== null) {
      fecharCartaoFixo();
      desenharFixos();
    }
    definirColarFixos(true);
    document.getElementById('fixos-colar-texto').focus();
  } else {
    definirColarFixos(false);
  }
});

function limparPreviaFixos() {
  document.getElementById('fixos-colar-previa').replaceChildren();
}

const TIPOS_COLAR = { casa: 'casa', 'da casa': 'casa', pessoal: 'pessoal' };
const MODOS_COLAR = { sozinho: false, confirmar: true };

// Devolve { validas: [{ linha, fixo, categoriaNova }], invalidas: [{ linha, texto, motivo }] } sem mudar nada.
function analisarFixosColados(texto, hoje = dataParaTexto(new Date())) {
  const validas = [];
  const invalidas = [];
  const nomesUsados = new Set(fixos.map((f) => chaveTexto(f.nome)));
  const nomesNoTexto = new Set();
  // Categorias novas, por nome normalizado: o tipo é o da primeira linha que a usa.
  const novas = new Map();
  texto.replace(/^﻿/, '').split(/\r\n|\r|\n/).forEach((bruta, i) => {
    const linha = bruta.trim();
    if (!linha) return;
    const recusar = (motivo) => invalidas.push({ linha: i + 1, texto: linha, motivo });
    const partes = linha.split(';').map((p) => p.trim());
    if (partes.length < 6) return recusar('faltam campos (são 6: nome, valor, dia, categoria, casa ou pessoal, sozinho ou confirmar).');
    if (partes.length > 7) return recusar('campos a mais.');
    const [nomeBruto, valorBruto, diaBruto, categoriaBruta, tipoBruto, modoBruto, fimBruto] = partes;
    const nome = primeiraMaiuscula(nomeBruto.replace(/\s+/g, ' '));
    if (!nome) return recusar('falta o nome.');
    if (nome.length > NOME_FIXO_MAXIMO) return recusar(`o nome tem mais de ${NOME_FIXO_MAXIMO} letras.`);
    const valor = lerValor(valorBruto);
    if (valor.erro) return recusar(`valor: ${valor.erro.charAt(0).toLowerCase()}${valor.erro.slice(1)}`);
    const dia = /^\d{1,2}$/.test(diaBruto) ? Number(diaBruto) : NaN;
    if (!(dia >= 1 && dia <= 31)) return recusar('o dia tem de ser de 1 a 31.');
    const nomeCategoria = primeiraMaiuscula(categoriaBruta.replace(/\s+/g, ' '));
    if (!nomeCategoria) return recusar('falta a categoria.');
    if (chaveTexto(nomeCategoria) === chaveTexto(CATEGORIA_POR_CATEGORIZAR)) return recusar(`a categoria não pode ser "${CATEGORIA_POR_CATEGORIZAR}".`);
    if (nomeCategoria.length > 40) return recusar('a categoria tem mais de 40 letras.');
    const tipo = TIPOS_COLAR[chaveTexto(tipoBruto)];
    if (!tipo) return recusar('escreve "casa" ou "pessoal" no 5.º campo.');
    const confirmar = MODOS_COLAR[chaveTexto(modoBruto)];
    if (confirmar === undefined) return recusar('escreve "sozinho" ou "confirmar" no 6.º campo.');
    const inicio = mesDaProximaVez(dia, hoje);
    let fim = null;
    if (fimBruto !== undefined && fimBruto !== '') {
      if (!eMesTexto(fimBruto)) return recusar('o último mês tem de ser AAAA-MM (ex.: 2027-06).');
      if (fimBruto < inicio) return recusar(`o último mês é antes do primeiro (${nomeDoMes(inicio)}).`);
      fim = fimBruto;
    }
    if (nomesUsados.has(chaveTexto(nome))) return recusar(`«${nome}» já existe nos gastos fixos.`);
    if (nomesNoTexto.has(chaveTexto(nome))) return recusar(`«${nome}» está repetido no texto.`);
    nomesNoTexto.add(chaveTexto(nome));
    const existente = categoriasDespesas.find((c) => chaveTexto(c.nome) === chaveTexto(nomeCategoria));
    let categoriaNova = null;
    if (!existente) {
      if (!novas.has(chaveTexto(nomeCategoria))) novas.set(chaveTexto(nomeCategoria), { nome: nomeCategoria, tipo });
      categoriaNova = novas.get(chaveTexto(nomeCategoria));
    }
    validas.push({
      linha: i + 1,
      categoriaNova,
      fixo: {
        nome,
        categoria: existente ? existente.id : null,
        nomeCategoria: existente ? existente.nome : categoriaNova.nome,
        tipo,
        centimos: valor.centimos,
        dia,
        confirmar,
        inicio,
        fim,
      },
    });
    return undefined;
  });
  return { validas, invalidas };
}

function mostrarPreviaFixos(analise) {
  const { validas, invalidas } = analise;
  const n = validas.length;
  const elementos = [];
  if (n) {
    elementos.push(criar('h3', { textContent: `Vão ser criados (${n})` }),
      criar('ul', { className: 'previa-lista previa-fixos' }, ...validas.map(({ fixo, categoriaNova }) => criar('li', {},
        criar('strong', { textContent: fixo.nome }),
        ` — ${formatarEuros(fixo.centimos)} · dia ${fixo.dia} · ${fixo.nomeCategoria}`,
        ...(categoriaNova ? [criar('span', { className: 'previa-nova', textContent: ` (nova categoria, ${categoriaNova.tipo === 'pessoal' ? 'pessoal' : 'da casa'})` })] : []),
        ` · ${fixo.tipo === 'pessoal' ? 'pessoal' : 'da casa'} · ${fixo.confirmar ? 'confirmar valor' : 'entra sozinho'}`,
        ` · começa em ${nomeDoMes(fixo.inicio)}${fixo.fim ? ` · termina em ${nomeDoMes(fixo.fim)}` : ''}`))));
  }
  if (invalidas.length) {
    elementos.push(criar('h3', { textContent: `Não entram (${invalidas.length})` }),
      criar('ul', { className: 'previa-lista previa-fixos' }, ...invalidas.map((inv) => criar('li', {},
        criar('span', { className: 'previa-invalida', textContent: `Linha ${inv.linha}: ` }),
        `${inv.motivo} `,
        criar('span', { className: 'previa-original', textContent: `(${inv.texto})` })))));
  }
  if (!n && !invalidas.length) {
    elementos.push(criar('p', { className: 'nota-previa', textContent: 'O texto está vazio.' }));
  }
  elementos.push(criar('div', { className: 'previa-fixos-botoes' },
    criar('button', {
      type: 'button',
      className: 'botao-principal',
      textContent: `Criar ${n} ${n === 1 ? 'gasto fixo' : 'gastos fixos'}`,
      disabled: n === 0,
      onclick: () => gravarFixosColados(analise),
    }),
    criar('button', { type: 'button', className: 'botao-secundario', textContent: 'Cancelar', onclick: limparPreviaFixos })));
  document.getElementById('fixos-colar-previa').replaceChildren(...elementos);
}

// Cria as categorias novas (antes de Outros, com o tipo da primeira linha que as usa) e os fixos; depois, os gastos já
// devidos. Com o mesmo nome entretanto criado (ex.: noutro sítio), usa a categoria que já existe.
function gravarFixosColados(analise) {
  const antesCategorias = categoriasDespesas;
  const idsNovas = new Map();
  analise.validas.forEach(({ categoriaNova }) => {
    if (!categoriaNova || idsNovas.has(chaveTexto(categoriaNova.nome))) return;
    const existente = categoriasDespesas.find((c) => chaveTexto(c.nome) === chaveTexto(categoriaNova.nome));
    if (existente) {
      idsNovas.set(chaveTexto(categoriaNova.nome), existente.id);
      return;
    }
    const id = novoId();
    idsNovas.set(chaveTexto(categoriaNova.nome), id);
    categoriasDespesas = [...categoriasDespesas.slice(0, -1), { id, nome: categoriaNova.nome, tipo: categoriaNova.tipo }, categoriasDespesas[categoriasDespesas.length - 1]];
  });
  if (categoriasDespesas !== antesCategorias && !guardarCategoriasDespesas()) {
    categoriasDespesas = antesCategorias;
    return;
  }
  const nomes = new Set(fixos.map((f) => chaveTexto(f.nome)));
  const novos = analise.validas
    .filter(({ fixo }) => !nomes.has(chaveTexto(fixo.nome)))
    .map(({ fixo, categoriaNova }) => {
      const categoria = categoriaNova ? idsNovas.get(chaveTexto(categoriaNova.nome)) : fixo.categoria;
      return {
        id: novoId(),
        nome: fixo.nome,
        categoria,
        ...(fixo.tipo !== tipoDaCategoria(categoria) ? { tipo: fixo.tipo } : {}),
        centimos: fixo.centimos,
        dia: fixo.dia,
        confirmar: fixo.confirmar,
        inicio: fixo.inicio,
        fim: fixo.fim,
        ativo: true,
      };
    });
  const antes = fixos;
  fixos = [...fixos, ...novos];
  if (!guardarFixos()) {
    fixos = antes;
    return;
  }
  document.getElementById('fixos-colar-texto').value = '';
  definirColarFixos(false);
  if (categoriasDespesas !== antesCategorias) {
    correrSemFalhar(desenharCategoriasDespesas);
    fecharNovaDespesa();
  }
  criarDevidosEMostrar();
  desenharMes();
  avisar(`${novos.length} ${novos.length === 1 ? 'gasto fixo guardado' : 'gastos fixos guardados'}.`);
}

document.getElementById('fixos-colar-formulario').addEventListener('submit', (evento) => {
  evento.preventDefault();
  mostrarPreviaFixos(analisarFixosColados(document.getElementById('fixos-colar-texto').value));
});
// Se o texto mudar, a pré-visualização deixa de corresponder.
document.getElementById('fixos-colar-texto').addEventListener('input', limparPreviaFixos);

// Na primeira vez, nada a guardar: a chave só aparece quando houver um gasto fixo.
desenharResumoFixos();
