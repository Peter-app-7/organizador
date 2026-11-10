// comerciantes.js: comerciantes lembrados. Quando se muda a categoria de um gasto importado do cartão, a app guarda
// uma regra (comerciante -> categoria, com um nome a mostrar opcional) e as importações seguintes desse comerciante
// entram logo nessa categoria. As regras veem-se, editam-se e apagam-se em "Categorias de gastos".
// Ficam numa chave própria e entram nas cópias de segurança como "regrasComerciantes".

const CHAVE_COMERCIANTES = 'organizador-comerciantes';

// Nome do comerciante para comparar: minúsculas, sem acentos, sem números nem pontuação.
// Ex.: "PINGO DOCE 0342 LISBOA" passa a "pingo doce lisboa".
function chaveComerciante(texto) {
  return chaveTexto(String(texto || '')).replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// O mesmo comerciante se os nomes forem iguais ou se um começar pelo outro, em palavras inteiras
// (ex.: "pingo doce lisboa" e "pingo doce"; mas não "pingo" e "pingos").
function chavesDoMesmoComerciante(a, b) {
  if (!a || !b) return false;
  return a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `);
}

// Parte do nome antes do primeiro número, para a regra servir a todas as lojas da marca.
// Ex.: "PINGO DOCE 0342 LISBOA" passa a "PINGO DOCE". Sem letras antes dos números, fica o nome todo.
function nomeBaseComerciante(texto) {
  const limpo = String(texto || '').replace(/\s+/g, ' ').trim();
  const antes = limpo.split(/\d/)[0].replace(/[\s\-–—,.;:#*/|]+$/, '').trim();
  return chaveComerciante(antes) ? antes : limpo;
}

// Regras vindas de fora (do aparelho ou de uma cópia): só as completas, sem comerciantes repetidos e com uma categoria
// que exista. Lança um erro se não for uma lista.
function normalizarRegrasComerciantes(lista, categorias) {
  if (!Array.isArray(lista)) throw new Error('Formato desconhecido');
  const idsCategorias = new Set(categorias.map((c) => c.id));
  const chaves = new Set();
  const ids = new Set();
  const limpas = [];
  lista.forEach((r) => {
    if (!r || typeof r.comerciante !== 'string' || !idsCategorias.has(r.categoria)) return;
    const comerciante = r.comerciante.replace(/\s+/g, ' ').trim().slice(0, NOTA_MAXIMA);
    const chave = chaveComerciante(comerciante);
    if (!chave || chaves.has(chave)) return;
    chaves.add(chave);
    const id = typeof r.id === 'string' && r.id && !ids.has(r.id) ? r.id : novoId();
    ids.add(id);
    const nome = typeof r.nome === 'string' ? r.nome.replace(/\s+/g, ' ').trim().slice(0, NOTA_MAXIMA) : '';
    limpas.push({ id, comerciante, nome, categoria: r.categoria });
  });
  return limpas;
}

let regrasComerciantes = normalizarRegrasComerciantes(lerChave(CHAVE_COMERCIANTES, 'regras') || [], categoriasDespesas);

function guardarRegrasComerciantes() {
  return guardarChave(CHAVE_COMERCIANTES, { versao: 1, regras: regrasComerciantes });
}

// A regra deste comerciante, ou null. Com várias possíveis, fica a de nome mais comprido (a mais precisa).
function regraDoComerciante(texto) {
  const chave = chaveComerciante(texto);
  let melhor = null;
  regrasComerciantes.forEach((regra) => {
    const chaveRegra = chaveComerciante(regra.comerciante);
    if (chavesDoMesmoComerciante(chave, chaveRegra) && (!melhor || chaveRegra.length > chaveComerciante(melhor.comerciante).length)) melhor = regra;
  });
  return melhor;
}

function idPorCategorizar() {
  const categoria = categoriasDespesas.find((c) => chaveTexto(c.nome) === chaveTexto(CATEGORIA_POR_CATEGORIZAR));
  return categoria ? categoria.id : null;
}

// Nome do comerciante de um gasto importado: o que veio no ficheiro ou, nos importados antes de 10 nov 2026, a nota.
function comercianteDoGasto(registo, notaAntes = registo.nota) {
  if (registo.comerciante) return registo.comerciante;
  return notaAntes && notaAntes !== 'Sem nome' ? notaAntes : '';
}

// Chamada ao guardar um gasto do cartão com outra categoria. "antes" é o gasto como estava.
// Guarda (ou atualiza) a regra do comerciante e pergunta se aplica aos gastos "Por categorizar" do mesmo comerciante.
// Devolve o texto do aviso, ou null se não havia comerciante.
function lembrarComerciante(registo, antes) {
  const original = comercianteDoGasto(registo, antes.nota);
  if (!chaveComerciante(original)) return null;
  const porCategorizar = idPorCategorizar();
  let regra = regraDoComerciante(original);

  // Voltar a pôr um gasto em "Por categorizar" faz esquecer o comerciante.
  if (registo.categoria === porCategorizar) {
    if (!regra) return null;
    regrasComerciantes = regrasComerciantes.filter((r) => r !== regra);
    guardarRegrasComerciantes();
    return `Gasto alterado. "${regra.comerciante}" deixou de ser lembrado.`;
  }

  // Se o nome foi mudado ao mesmo tempo, passa a ser o nome a mostrar nas importações seguintes.
  const nome = registo.nota !== antes.nota ? registo.nota : (regra ? regra.nome : '');
  const antesDaRegra = regra ? { ...regra } : null;
  if (regra) Object.assign(regra, { categoria: registo.categoria, nome });
  else {
    regra = { id: novoId(), comerciante: nomeBaseComerciante(original), nome, categoria: registo.categoria };
    regrasComerciantes.push(regra);
  }
  if (!guardarRegrasComerciantes()) {
    if (antesDaRegra) Object.assign(regra, antesDaRegra);
    else regrasComerciantes = regrasComerciantes.filter((r) => r !== regra);
    return 'Gasto alterado.';
  }

  const categoria = nomeCategoriaDespesa(regra.categoria);
  const iguais = porCategorizar ? despesas.filter((d) => d !== registo && d.categoria === porCategorizar
    && chavesDoMesmoComerciante(chaveComerciante(comercianteDoGasto(d)), chaveComerciante(regra.comerciante))) : [];
  let aplicados = 0;
  if (iguais.length > 0) {
    const texto = iguais.length === 1 ? 'Há mais 1 gasto' : `Há mais ${iguais.length} gastos`;
    if (confirm(`Aplicar a todos os gastos deste comerciante?\n\n${texto} de "${regra.comerciante}" em "${CATEGORIA_POR_CATEGORIZAR}", que ${iguais.length === 1 ? 'passa' : 'passam'} para "${categoria}".`)) {
      const copia = iguais.map((d) => ({ ...d }));
      iguais.forEach((d) => {
        d.categoria = regra.categoria;
        if (regra.nome) d.nota = regra.nome;
      });
      if (guardarDespesas()) aplicados = iguais.length;
      else iguais.forEach((d, i) => Object.assign(d, copia[i]));
    }
  }
  correrSemFalhar(desenharComerciantes);
  return `A app vai lembrar: ${regra.comerciante} → ${categoria}.${aplicados ? ` ${aplicados} ${aplicados === 1 ? 'gasto passou' : 'gastos passaram'} também.` : ''}`;
}

// Apagar uma categoria: os comerciantes com essa categoria são esquecidos.
function esquecerRegrasDaCategoria(id) {
  const antes = regrasComerciantes.length;
  regrasComerciantes = regrasComerciantes.filter((r) => r.categoria !== id);
  if (regrasComerciantes.length !== antes) guardarRegrasComerciantes();
}

// --- Lista "Comerciantes lembrados", em "Categorias de gastos" ---
let regraAEditar = null; // id da regra aberta para editar

function formularioRegra(regra) {
  const campo = (id, etiqueta, entrada) => {
    entrada.id = `regra-${id}`;
    entrada.setAttribute('aria-describedby', `regra-${id}-erro`);
    const erro = criar('p', { id: `regra-${id}-erro`, className: 'erro-campo', hidden: true });
    return { entrada, erro, rotulo: criar('label', { htmlFor: entrada.id }, etiqueta, entrada, erro) };
  };
  const comerciante = campo('comerciante', 'Comerciante (como vem no cartão)', criar('input', {
    type: 'text', value: regra.comerciante, autocomplete: 'off', autocapitalize: 'words', maxLength: NOTA_MAXIMA,
  }));
  const nome = campo('nome', 'Nome a mostrar (opcional)', criar('input', {
    type: 'text', value: regra.nome, placeholder: 'Igual ao do cartão', autocomplete: 'off', autocapitalize: 'words', maxLength: NOTA_MAXIMA,
  }));
  const categoria = campo('categoria', 'Categoria', criar('select', {},
    ...categoriasDespesas.map((c) => criar('option', { value: c.id, textContent: c.nome }))));
  categoria.entrada.value = regra.categoria;
  const guardar = criar('button', { type: 'submit', className: 'botao-principal', textContent: 'Guardar' });
  const formulario = criar('form', { className: 'formulario formulario-gasto', noValidate: true },
    comerciante.rotulo, nome.rotulo, categoria.rotulo, guardar,
    criar('button', { type: 'button', className: 'botao-secundario', textContent: 'Cancelar', onclick: () => { regraAEditar = null; desenharComerciantes(); } }));

  const mostrarErro = (parte, mensagem) => {
    parte.erro.textContent = mensagem || '';
    parte.erro.hidden = !mensagem;
    if (mensagem) parte.entrada.setAttribute('aria-invalid', 'true');
    else parte.entrada.removeAttribute('aria-invalid');
  };
  [comerciante, nome, categoria].forEach((parte) => parte.entrada.addEventListener('input', () => mostrarErro(parte, null)));
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const texto = comerciante.entrada.value.replace(/\s+/g, ' ').trim();
    const chave = chaveComerciante(texto);
    const repetida = regrasComerciantes.find((r) => r !== regra && chaveComerciante(r.comerciante) === chave);
    let erro = null;
    if (!chave) erro = 'Escreve o nome do comerciante, com letras.';
    else if (repetida) erro = `Já há uma regra para "${repetida.comerciante}".`;
    mostrarErro(comerciante, erro);
    if (erro) {
      comerciante.entrada.focus();
      return;
    }
    const antes = { ...regra };
    Object.assign(regra, { comerciante: texto, nome: nome.entrada.value.replace(/\s+/g, ' ').trim(), categoria: categoria.entrada.value });
    if (!guardarRegrasComerciantes()) {
      Object.assign(regra, antes);
      return;
    }
    regraAEditar = null;
    desenharComerciantes();
    avisar('Comerciante alterado. Vale para as próximas importações.');
  });
  formulario.addEventListener('focusin', () => setTimeout(() => manterVisivel(guardar), 350));
  return formulario;
}

function desenharComerciantes() {
  const caixa = document.getElementById('despesas-comerciantes');
  if (!caixa) return;
  if (regrasComerciantes.length === 0) {
    caixa.replaceChildren(criar('p', { className: 'nota-previa', textContent: 'Ainda não há comerciantes lembrados. Muda a categoria de um gasto importado do cartão e a app passa a lembrá-la.' }));
    return;
  }
  const ordenadas = [...regrasComerciantes].sort((a, b) => a.comerciante.localeCompare(b.comerciante, 'pt-PT', { sensitivity: 'base' }));
  caixa.replaceChildren(criar('ul', { className: 'lista categorias-lista' }, ...ordenadas.map((regra) => {
    if (regra.id === regraAEditar) return criar('li', { className: 'categoria-linha categoria-a-editar' }, formularioRegra(regra));
    const categoria = nomeCategoriaDespesa(regra.categoria);
    return criar('li', { className: 'categoria-linha' },
      criar('span', { className: 'categoria-nome' },
        `${regra.comerciante} → ${categoria}`,
        ...(regra.nome ? [criar('span', { className: 'categoria-detalhe', textContent: `aparece como "${regra.nome}"` })] : [])),
      criar('button', {
        type: 'button', className: 'botao-pequeno', textContent: 'Editar', 'aria-label': `Editar ${regra.comerciante}`,
        onclick: () => { regraAEditar = regra.id; desenharComerciantes(); },
      }),
      botaoApagar(`o comerciante ${regra.comerciante}`, () => {
        if (!confirm(`Esquecer "${regra.comerciante}" → ${categoria}?\n\nOs gastos já registados não mudam; as próximas importações deste comerciante entram em "${CATEGORIA_POR_CATEGORIZAR}".`)) return;
        const antes = regrasComerciantes;
        regrasComerciantes = regrasComerciantes.filter((r) => r !== regra);
        if (!guardarRegrasComerciantes()) {
          regrasComerciantes = antes;
          return;
        }
        if (regraAEditar === regra.id) regraAEditar = null;
        desenharComerciantes();
        avisar(`"${regra.comerciante}" deixou de ser lembrado.`);
      }));
  })));
}
