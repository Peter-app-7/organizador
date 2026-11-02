// compras.js: vista Compras. Lista da casa, por tipo de produto, com sim/não para comprar.

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
    botaoApagar(produto.nome, () => {
      dados.compras = dados.compras.filter((p) => p.id !== produto.id);
      guardarDados();
      desenharCompras();
    }));
}

function desenharCompras() {
  const soComprar = document.getElementById('compras-filtro').checked;
  const visiveis = dados.compras.filter((p) => !soComprar || p.comprar);
  const caixa = document.getElementById('compras-lista');
  caixa.replaceChildren();

  TIPOS_COMPRAS.forEach((tipo) => {
    const produtos = visiveis
      .filter((p) => p.tipo === tipo)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-PT'));
    if (produtos.length === 0) return;
    caixa.append(
      criar('h3', { textContent: tipo }),
      criar('ul', { className: 'lista' }, ...produtos.map(linhaProduto)),
    );
  });

  if (visiveis.length === 0) {
    const mensagem = soComprar ? 'Nada para comprar.' : 'A lista está vazia.';
    caixa.append(criar('p', { className: 'vazio', textContent: mensagem }));
  }
}

const seletorTipo = document.getElementById('compras-tipo');
TIPOS_COMPRAS.forEach((tipo) => {
  seletorTipo.append(criar('option', { value: tipo, textContent: tipo }));
});

document.getElementById('compras-formulario').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const campo = document.getElementById('compras-nome');
  const nome = campo.value.trim();
  if (!nome) return;
  dados.compras.push({ id: novoId(), nome, tipo: seletorTipo.value, comprar: true });
  guardarDados();
  campo.value = '';
  desenharCompras();
});
document.getElementById('compras-filtro').addEventListener('change', desenharCompras);

desenhar.compras = desenharCompras;
