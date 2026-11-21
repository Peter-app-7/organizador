// compras.js: lista de produtos da vista Mercearia. Lista da casa, por tipo de produto, com sim/não para comprar.

let comprasAEditar = false;
// Produto aberto para editar (nome e categoria), no modo Editar: o id, ou null. Só um de cada vez.
let produtoAEditar = null;

function definirComprar(produto, valor) {
  produto.comprar = valor;
  guardarDados();
  desenharCompras();
}

function fecharProdutoAEditar() {
  produtoAEditar = null;
  desenharCompras();
}

// Cartão para mudar o nome e a categoria de um produto, ali mesmo na lista. Mantém o id e o sim/não.
function cartaoProduto(produto, tipos) {
  const erro = criar('p', { id: 'produto-editar-nome-erro', className: 'erro-campo', hidden: true });
  const nome = criar('input', {
    id: 'produto-editar-nome', type: 'text', value: produto.nome, maxLength: 100, autocomplete: 'off',
    autocapitalize: 'sentences', enterKeyHint: 'done', 'aria-describedby': 'produto-editar-nome-erro',
  });
  const tipo = criar('select', { id: 'produto-editar-tipo' },
    ...tipos.map((t) => criar('option', { value: t, textContent: t })));
  tipo.value = tipoMostrado(produto, tipos);
  // Valores iniciais: se chegar uma alteração da nuvem com o cartão aberto, só os campos não mexidos acompanham.
  nome.dataset.inicial = nome.value;
  tipo.dataset.inicial = tipo.value;
  nome.addEventListener('input', () => { erro.hidden = true; nome.removeAttribute('aria-invalid'); });
  const formulario = criar('form', { className: 'formulario-edicao', noValidate: true },
    criar('label', { htmlFor: nome.id, textContent: 'Nome do produto' }), nome, erro,
    criar('label', { htmlFor: tipo.id, textContent: 'Categoria' }), tipo,
    // Só com uma casa ligada (lista partilhada, casa.js).
    ...(codigoCasa ? [criar('p', { className: 'nota nota-edicao', textContent: 'O nome novo também muda no outro telemóvel.' })] : []));
  formulario.append(botoesEdicao(formulario, { aoCancelar: fecharProdutoAEditar }));
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const novoNome = primeiraMaiuscula(nome.value.replace(/\s+/g, ' '));
    // O mesmo produto pode ficar com outras maiúsculas; outro produto com o mesmo nome (sem maiúsculas, acentos nem
    // quantidade, em qualquer categoria, como no "Adicionar") não.
    const outro = novoNome && dados.compras.find((p) => p.id !== produto.id && chaveProduto(p.nome) === chaveProduto(novoNome));
    const mensagem = !novoNome ? 'Escreve o nome do produto.' : (outro ? `Já existe «${outro.nome}» em ${tipoMostrado(outro, tiposDeCompras())}.` : null);
    if (mensagem) {
      erro.textContent = mensagem;
      erro.hidden = false;
      nome.setAttribute('aria-invalid', 'true');
      nome.focus();
      return;
    }
    // A categoria só muda se foi escolhida outra (assim, um tipo guardado com outras maiúsculas fica como está).
    const novoTipo = tipo.value !== tipoMostrado(produto, tiposDeCompras()) ? tipo.value : produto.tipo;
    const mudou = novoNome !== produto.nome || novoTipo !== produto.tipo;
    if (mudou) {
      produto.nome = novoNome;
      produto.tipo = novoTipo;
      guardarDados(); // com uma casa ligada, segue para a nuvem (notarMudancasCompras)
    }
    produtoAEditar = null;
    desenharCompras();
    if (mudou) avisar(`Produto alterado: ${novoNome} (${tipoMostrado(produto, tiposDeCompras())}).`);
  });
  const cartao = criar('li', { className: 'produto-editar cartao-edicao' }, formulario);
  cartao.dataset.produto = produto.id; // para não passar o que se escreveu para outro produto (ver guardarCartaoProduto)
  return cartao;
}

function linhaProduto(produto, tipos) {
  if (comprasAEditar && produtoAEditar === produto.id) return cartaoProduto(produto, tipos);
  // No modo Editar: o nome, o lápis e o ×; o sim/não fica escondido para caberem.
  if (comprasAEditar) {
    return criar('li', { className: 'linha' },
      criar('span', { className: 'linha-texto', textContent: produto.nome }),
      // Abrir outro produto fecha o que estava aberto, sem guardar.
      // O teclado só abre aqui, ao tocar no lápis (não quando a lista é desenhada outra vez).
      botaoLapis(`Editar ${produto.nome}`, () => {
        produtoAEditar = produto.id;
        desenharCompras();
        const campo = document.getElementById('produto-editar-nome');
        if (campo) campo.focus();
      }),
      botaoApagar(produto.nome, () => {
        dados.compras = dados.compras.filter((p) => p.id !== produto.id);
        guardarDados();
        desenharCompras();
      }));
  }
  return criar('li', { className: 'linha' },
    criar('span', { className: 'linha-texto', textContent: produto.nome }),
    criar('div', { className: 'sim-nao', 'aria-label': `Comprar ${produto.nome}?` },
      criar('button', {
        type: 'button',
        textContent: 'Sim',
        'aria-pressed': String(produto.comprar),
        onclick: () => definirComprar(produto, true),
      }),
      criar('button', {
        type: 'button',
        textContent: 'Não',
        'aria-pressed': String(!produto.comprar),
        onclick: () => definirComprar(produto, false),
      })));
}

// Tipo em que o produto aparece: compara sem maiúsculas nem acentos, e um tipo desconhecido vai para "Outros",
// para nenhum produto ficar escondido. Não muda o que está guardado.
function tipoMostrado(produto, tipos) {
  return tipos.find((tipo) => chaveTexto(tipo) === chaveTexto(produto.tipo)) || 'Outros';
}

function contarParaComprar() {
  return dados.compras.filter((p) => p.comprar).length;
}

function desenharContadorCompras() {
  const numero = contarParaComprar();
  document.getElementById('compras-contador').textContent = numero === 0
    ? 'Nada por comprar'
    : `${numero} ${numero === 1 ? 'produto' : 'produtos'} por comprar`;
  document.getElementById('compras-limpar').hidden = numero === 0;
  // Com a lista recolhida, o número fica visível ao lado de "Produtos".
  const recolhidos = document.getElementById('produtos-corpo').hidden;
  document.getElementById('produtos-resumo').textContent = recolhidos && numero > 0 ? `· ${numero} por comprar` : '';
}

// Depois das compras: os produtos marcados "Sim" passam a "Não". Nenhum produto sai da lista.
function limparComprados() {
  const numero = contarParaComprar();
  if (numero === 0) return;
  const texto = numero === 1 ? 'o produto marcado' : `os ${numero} produtos marcados`;
  if (!confirm(`Já compraste tudo? ${primeiraMaiuscula(texto)} com "Sim" passam a "Não". Os produtos continuam na lista.`)) return;
  dados.compras.forEach((p) => { p.comprar = false; });
  const hoje = dataParaTexto(new Date());
  dados.comprasFeitas[hoje] = (dados.comprasFeitas[hoje] || 0) + numero;
  guardarDados();
  desenharCompras();
  avisar(`${numero} ${numero === 1 ? 'produto passou' : 'produtos passaram'} para "Não".`);
}

function desenharCompras() {
  const soComprar = document.getElementById('compras-filtro').checked;
  const visiveis = dados.compras.filter((p) => !soComprar || p.comprar);
  const caixa = document.getElementById('compras-lista');
  // Um produto aberto para editar que deixou de existir (ex.: apagado no outro telemóvel) fecha-se.
  if (produtoAEditar && !(comprasAEditar && dados.compras.some((p) => p.id === produtoAEditar))) produtoAEditar = null;
  // O que está a ser escrito no cartão não se perde quando a lista é desenhada outra vez (ex.: chega uma alteração da nuvem).
  const escrito = guardarCartaoProduto(caixa);
  caixa.replaceChildren();

  desenharContadorCompras();
  atualizarSeletorTipo();
  const caixaCategorias = document.getElementById('compras-categorias-caixa');
  if (comprasAEditar && caixaCategorias.open && !caixaCategorias.contains(document.activeElement)) desenharCategoriasCompras();
  const tipos = tiposDeCompras();
  tipos.forEach((tipo) => {
    const produtos = visiveis
      .filter((p) => tipoMostrado(p, tipos) === tipo)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-PT', { sensitivity: 'base' })); // ignora maiúsculas e acentos
    if (produtos.length === 0) return;
    caixa.append(
      criar('h3', { textContent: tipo }),
      criar('ul', { className: 'lista' }, ...produtos.map((p) => linhaProduto(p, tipos))),
    );
  });
  // O cartão pode ter ficado escondido pelo filtro "Mostrar só o que é para comprar": então fecha-se.
  if (produtoAEditar && !caixa.querySelector('.produto-editar')) produtoAEditar = null;
  reporCartaoProduto(caixa, escrito);
  // Com um produto aberto, o "voltar" do Android fecha-o (sem guardar), como o Cancelar.
  if (produtoAEditar) abrirComVoltar('editar-produto', 'mercearia', fecharProdutoAEditar);
  else fechadoSemVoltar('editar-produto');

  if (visiveis.length === 0) {
    const mensagem = soComprar ? 'Nada para comprar.' : 'A lista está vazia. Toca em Editar para acrescentar produtos.';
    caixa.append(criar('p', { className: 'vazio', textContent: mensagem }));
  }
}

// Valores do cartão aberto antes de desenhar outra vez: { id, nome, tipo, foco, inicio, fim } ou null.
// Guarda só os campos que o utilizador mudou (diferentes do valor inicial).
function guardarCartaoProduto(caixa) {
  const cartao = caixa.querySelector('.produto-editar');
  const nome = caixa.querySelector('#produto-editar-nome');
  const tipo = caixa.querySelector('#produto-editar-tipo');
  if (!cartao || !nome || !tipo) return null;
  return {
    id: cartao.dataset.produto, // o produto do cartão que estava aberto (pode já ter sido aberto outro)
    nome: nome.value !== nome.dataset.inicial ? nome.value : null,
    tipo: tipo.value !== tipo.dataset.inicial ? tipo.value : null,
    foco: document.activeElement === nome ? 'nome' : (document.activeElement === tipo ? 'tipo' : null),
    inicio: nome.selectionStart,
    fim: nome.selectionEnd,
  };
}

function reporCartaoProduto(caixa, escrito) {
  if (!escrito || escrito.id !== produtoAEditar) return;
  const nome = caixa.querySelector('#produto-editar-nome');
  const tipo = caixa.querySelector('#produto-editar-tipo');
  if (!nome || !tipo) return;
  if (escrito.nome !== null) nome.value = escrito.nome;
  if (escrito.tipo !== null && [...tipo.options].some((o) => o.value === escrito.tipo)) tipo.value = escrito.tipo;
  if (escrito.foco === 'tipo') tipo.focus({ preventScroll: true });
  if (escrito.foco === 'nome') {
    nome.focus({ preventScroll: true });
    try { nome.setSelectionRange(escrito.inicio, escrito.fim); } catch (erro) { /* sem seleção: não faz mal */ }
  }
}

const seletorTipo = document.getElementById('compras-tipo');

// Os tipos podem mudar ao importar uma lista: mantém a escolha atual, se ainda existir.
function atualizarSeletorTipo() {
  const escolhido = seletorTipo.value;
  seletorTipo.replaceChildren(...tiposDeCompras().map((tipo) => criar('option', { value: tipo, textContent: tipo })));
  if (tiposDeCompras().includes(escolhido)) seletorTipo.value = escolhido;
}

document.getElementById('compras-formulario').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const campo = document.getElementById('compras-nome');
  const nome = primeiraMaiuscula(campo.value.replace(/\s+/g, ' '));
  if (!nome) return;
  // Não duplica: compara sem maiúsculas, acentos nem quantidade, em qualquer tipo (ver lista-semanal.js).
  const existente = dados.compras.find((p) => chaveProduto(p.nome) === chaveProduto(nome));
  if (existente) {
    if (existente.comprar) {
      avisar(`"${existente.nome}" já está na lista para comprar.`);
    } else {
      existente.comprar = true;
      guardarDados();
      avisar(`"${existente.nome}" já estava na lista: passou para "Sim".`);
    }
  } else {
    dados.compras.push({ id: novoId(), nome, tipo: seletorTipo.value, comprar: true });
    guardarDados();
  }
  campo.value = '';
  campo.focus(); // o teclado fica aberto para o produto seguinte
  desenharCompras();
});
document.getElementById('compras-limpar').addEventListener('click', limparComprados);
document.getElementById('compras-filtro').addEventListener('change', desenharCompras);
// Modo de edição: campo de novo produto, categorias, importar e o × para apagar. O "voltar" do Android também o fecha.
function definirEdicaoCompras(aEditar) {
  comprasAEditar = aEditar;
  const botao = document.getElementById('compras-editar');
  document.getElementById('compras-gerir').hidden = !comprasAEditar;
  botao.textContent = comprasAEditar ? 'Fechar' : 'Editar';
  botao.setAttribute('aria-expanded', String(comprasAEditar));
  if (comprasAEditar) {
    abrirComVoltar('editar-compras', 'mercearia', () => definirEdicaoCompras(false));
  } else {
    fechadoSemVoltar('editar-compras');
    // Um produto ou uma categoria abertos para editar ficam escondidos com o resto: deixam de contar para o "voltar".
    produtoAEditar = null;
    fechadoSemVoltar('editar-produto');
    estadoCategoriasCompras.aRenomear = null;
    fechadoSemVoltar('renomear-compras-categoria');
  }
  desenharCompras();
}
document.getElementById('compras-editar').addEventListener('click', () => definirEdicaoCompras(!comprasAEditar));

// --- Categorias (no modo de edição) ---
const estadoCategoriasCompras = { aRenomear: null };

function produtosDaCategoria(categoria) {
  return dados.compras.filter((p) => chaveTexto(p.tipo) === chaveTexto(categoria));
}

function itensCategoriasCompras() {
  return tiposDeCompras().map((nome) => {
    const numero = produtosDaCategoria(nome).length;
    return {
      chave: nome,
      nome,
      // "Outros" é para onde vão os produtos sem categoria conhecida: não se renomeia nem apaga.
      podeRenomear: nome !== 'Outros',
      podeApagar: nome !== 'Outros',
      detalhe: `${numero} ${numero === 1 ? 'produto' : 'produtos'}`,
    };
  });
}

function criarCategoriaCompras(nome) {
  garantirCategoriaCompras(nome);
  guardarDados();
  desenharCompras();
  return null;
}

// Os produtos da categoria passam para o novo nome; o resto (nome, sim/não) fica como estava.
function renomearCategoriaCompras(antiga, nova) {
  const indice = categoriasCompras.indexOf(antiga);
  if (indice === -1) return 'Esta categoria já não existe.';
  produtosDaCategoria(antiga).forEach((p) => { p.tipo = nova; });
  categoriasCompras[indice] = nova;
  acertarTiposCompras();
  guardarCategoriasCompras();
  guardarDados();
  desenharCompras();
  if (antiga !== nova) avisar(`Categoria "${antiga}" passou a "${nova}".`);
  return null;
}

// Só apaga categorias vazias: nenhum produto muda de categoria sem o utilizador decidir.
function apagarCategoriaCompras(nome) {
  const numero = produtosDaCategoria(nome).length;
  if (numero > 0) {
    const texto = numero === 1 ? 'tem 1 produto' : `tem ${numero} produtos`;
    avisar(`Não apagada: "${nome}" ${texto}. Só se apagam categorias vazias.`);
    return false;
  }
  categoriasCompras = categoriasCompras.filter((tipo) => tipo !== nome);
  acertarTiposCompras();
  guardarCategoriasCompras();
  guardarDados();
  desenharCompras();
  avisar(`Categoria "${nome}" apagada.`);
  return true;
}

function desenharCategoriasCompras() {
  desenharGestorCategorias(document.getElementById('compras-categorias'), {
    obterItens: itensCategoriasCompras,
    estado: estadoCategoriasCompras,
    prefixo: 'compras-categoria',
    vista: 'mercearia',
    aoCriar: criarCategoriaCompras,
    aoRenomear: renomearCategoriaCompras,
    aoApagar: apagarCategoriaCompras,
  });
}

document.getElementById('compras-categorias-caixa').addEventListener('toggle', (evento) => {
  if (evento.target.open) {
    desenharCategoriasCompras();
  } else {
    estadoCategoriasCompras.aRenomear = null;
    fechadoSemVoltar('renomear-compras-categoria');
  }
});
