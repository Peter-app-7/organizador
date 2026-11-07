// compras.js: lista de produtos da vista Gastos. Lista da casa, por tipo de produto, com sim/não para comprar.

let comprasAEditar = false;

function definirComprar(produto, valor) {
  produto.comprar = valor;
  guardarDados();
  desenharCompras();
}

function linhaProduto(produto) {
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
      })),
    // O × só existe no modo de edição.
    ...(comprasAEditar ? [botaoApagar(produto.nome, () => {
      dados.compras = dados.compras.filter((p) => p.id !== produto.id);
      guardarDados();
      desenharCompras();
    })] : []));
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
      criar('ul', { className: 'lista' }, ...produtos.map(linhaProduto)),
    );
  });

  if (visiveis.length === 0) {
    const mensagem = soComprar ? 'Nada para comprar.' : 'A lista está vazia. Toca em Editar para acrescentar produtos.';
    caixa.append(criar('p', { className: 'vazio', textContent: mensagem }));
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
document.getElementById('compras-editar').addEventListener('click', (evento) => {
  comprasAEditar = !comprasAEditar;
  document.getElementById('compras-gerir').hidden = !comprasAEditar;
  evento.currentTarget.textContent = comprasAEditar ? 'Fechar' : 'Editar';
  evento.currentTarget.setAttribute('aria-expanded', String(comprasAEditar));
  desenharCompras();
});

// --- Categorias (no modo de edição) ---
const estadoCategoriasCompras = { aRenomear: null };

function produtosDaCategoria(categoria) {
  return dados.compras.filter((p) => chaveTexto(p.tipo) === chaveTexto(categoria));
}

function itensCategoriasCompras() {
  return categoriasCompras.map((nome) => {
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

// Só apaga categorias vazias: nenhum produto muda de categoria sem o Peter decidir.
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
    aoCriar: criarCategoriaCompras,
    aoRenomear: renomearCategoriaCompras,
    aoApagar: apagarCategoriaCompras,
  });
}

document.getElementById('compras-categorias-caixa').addEventListener('toggle', (evento) => {
  if (evento.target.open) desenharCategoriasCompras();
  else estadoCategoriasCompras.aRenomear = null;
});
