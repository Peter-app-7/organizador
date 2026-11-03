// lista-semanal.js: botão "Adicionar lista semanal" da vista Compras.

// Para mudar a lista, basta editar aqui: ['Produto', 'quantidade'], dentro do tipo de produto.
const LISTA_SEMANAL = [
  {
    tipo: 'Carne e peixe',
    produtos: [
      ['Vaca picada', '400 g'],
      ['Bife de vaca', '400 g'],
      ['Bife de frango', '800 g'],
      ['Bife de peru', '400 g'],
      ['Salmão', '400 g'],
      ['Dourada ou robalo', '400 g'],
      ['Atum em lata', '2 latas'],
      ['Sardinhas em lata', '3 latas'],
    ],
  },
  {
    tipo: 'Laticínios e ovos',
    produtos: [
      ['Ovos', '15 un.'],
      ['Claras de ovo', '500 ml'],
      ['Cottage', '500 g'],
    ],
  },
  {
    tipo: 'Legumes e vegetais',
    produtos: [
      ['Salada', '800 g'],
      ['Brócolos', '1,2 kg'],
      ['Espargos', '500 g'],
      ['Espinafres', '500 g'],
      ['Cogumelos', '500 g'],
      ['Batata doce', '1 kg'],
      ['Cebola', '800 g'],
      ['Chucrute', '200 g'],
      ['Abóbora', '1 kg'],
    ],
  },
  {
    tipo: 'Despensa e outros',
    produtos: [
      ['Massa', '500 g'],
      ['Arroz', '500 g'],
      ['Tomate triturado', '1 lata'],
    ],
  },
  {
    tipo: 'Fruta',
    produtos: [
      ['Mirtilos', '500 g'],
      ['Amoras', '300 g'],
    ],
  },
];

// Nome do produto sem a quantidade, para comparar: "Ovos (15 un.)", "ovos 12", "Ovos x6" e "6 ovos" são o mesmo.
const UNIDADE = '(?:kg|gr?|mg|l|lt|ml|cl|un|uni|unid|unidades?|latas?|embalagens?|pacotes?)';
const QUANTIDADE_FIM = new RegExp(`[\\s,;:–—-]+(?:x\\s*)?\\d+(?:[.,]\\d+)?\\s*${UNIDADE}?\\.?$`, 'i');
const QUANTIDADE_INICIO = new RegExp(`^\\d+(?:[.,]\\d+)?\\s*(?:${UNIDADE}\\.?\\s+|x\\s+|\\s)(?:de\\s+)?`, 'i');

function nomeSemQuantidade(nome) {
  return nome.trim()
    .replace(/\s*\([^()]*\)$/, '')
    .replace(QUANTIDADE_FIM, '')
    .replace(QUANTIDADE_INICIO, '');
}

// O hífen conta como espaço: "Batata-doce" e "Batata doce" são o mesmo produto.
function chaveProduto(nome) {
  return chaveTexto(nomeSemQuantidade(nome).replace(/-/g, ' '));
}

function temQuantidade(nome) {
  return nomeSemQuantidade(nome) !== nome.trim();
}

// O que falta fazer: produtos que não estão nas compras, seja qual for o tipo em que lá estejam,
// e produtos que estão lá sem quantidade. Um produto que já tenha quantidade não entra em nenhuma das listas.
function planoListaSemanal() {
  const existentes = new Set(dados.compras.map((p) => chaveProduto(p.nome)));
  const quantidades = new Map();
  const novos = [];
  LISTA_SEMANAL.forEach(({ tipo, produtos }) => {
    produtos.forEach(([nome, quantidade]) => {
      const chave = chaveProduto(nome);
      quantidades.set(chave, quantidade);
      if (existentes.has(chave)) return;
      existentes.add(chave);
      novos.push({ nome: primeiraMaiuscula(`${nome} (${quantidade})`), tipo });
    });
  });
  const aPreencher = dados.compras
    .filter((p) => quantidades.has(chaveProduto(p.nome)) && !temQuantidade(p.nome))
    .map((produto) => ({ produto, quantidade: quantidades.get(chaveProduto(produto.nome)) }));
  return { novos, aPreencher };
}

// Devolve o tipo tal como a app o conhece; se for novo, passa a existir.
function tipoDeCompras(nome) {
  const conhecido = tiposDeCompras().find((tipo) => chaveTexto(tipo) === chaveTexto(nome));
  if (conhecido) return conhecido;
  dados.tiposCompras.push(nome);
  return nome;
}

function contarProdutos(numero) {
  return `${numero} ${numero === 1 ? 'produto' : 'produtos'}`;
}

function perguntaListaSemanal(novos, aPreencher) {
  if (aPreencher === 0) return `Adicionar ${contarProdutos(novos)}?`;
  if (novos === 0) return `Preencher a quantidade de ${contarProdutos(aPreencher)}?`;
  return `Adicionar ${contarProdutos(novos)} e preencher a quantidade de ${aPreencher}?`;
}

function adicionarListaSemanal() {
  const { novos, aPreencher } = planoListaSemanal();
  if (novos.length === 0 && aPreencher.length === 0) {
    avisar('Os produtos da lista semanal já estão todos na lista, com quantidade.');
    return;
  }
  if (!confirm(perguntaListaSemanal(novos.length, aPreencher.length))) return;
  novos.forEach(({ nome, tipo }) => {
    dados.compras.push({ id: novoId(), nome, tipo: tipoDeCompras(tipo), comprar: true });
  });
  // Só muda o nome: o tipo e o sim/não ficam como estavam.
  aPreencher.forEach(({ produto, quantidade }) => {
    produto.nome = `${produto.nome.trim()} (${quantidade})`;
  });
  guardarDados();
  desenharCompras();
  avisar('Lista semanal atualizada.');
}

document.getElementById('compras-lista-semanal').addEventListener('click', adicionarListaSemanal);
