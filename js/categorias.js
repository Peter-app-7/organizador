// categorias.js: lista de categorias que se edita no ecrã (criar, renomear e apagar).
// Usada pelas categorias das Compras (compras.js) e pelas categorias dos gastos (despesas.js).
// Cada linha tem só um lápis; tocar nele abre a linha ali mesmo, num cartão com o nome, "Guardar", "Cancelar" e,
// nas categorias que se podem apagar, "Apagar". O lápis e os botões do cartão servem também os produtos (compras.js).

// Botão com um lápis (SVG de traço, cor secundária), 44 x 44 px.
function botaoLapis(rotulo, aoTocar) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  ['M4 20l1.2-4.4L15.8 5a2.1 2.1 0 0 1 3 3L8.4 18.8z', 'M13.8 7l3.2 3.2'].forEach((d) => {
    const caminho = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    caminho.setAttribute('d', d);
    svg.append(caminho);
  });
  return criar('button', { type: 'button', className: 'botao-lapis', 'aria-label': rotulo, onclick: aoTocar }, svg);
}

// Botões do cartão de edição: "Guardar" (submit), "Cancelar" e, se houver aoApagar, "Apagar" encostado à direita.
// Com o teclado aberto, o "Guardar" fica visível; Esc cancela.
function botoesEdicao(formulario, { aoCancelar, aoApagar }) {
  const guardar = criar('button', { type: 'submit', className: 'botao-pequeno botao-pequeno-principal', textContent: 'Guardar' });
  formulario.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape') return;
    evento.preventDefault();
    aoCancelar();
  });
  formulario.addEventListener('focusin', () => setTimeout(() => manterVisivel(guardar), 350));
  return criar('div', { className: 'edicao-botoes' },
    guardar,
    criar('button', { type: 'button', className: 'botao-pequeno', textContent: 'Cancelar', onclick: aoCancelar }),
    ...(aoApagar ? [criar('button', { type: 'button', className: 'botao-apagar-texto', textContent: 'Apagar', onclick: aoApagar })] : []));
}

// Devolve { nome } ou { erro }. "existentes" são os nomes atuais; "atual" é o nome a renomear, que pode repetir-se
// (por exemplo, para corrigir só as maiúsculas). Compara sem maiúsculas nem acentos.
function validarNomeCategoria(texto, existentes, atual = null) {
  const nome = primeiraMaiuscula(texto.replace(/\s+/g, ' '));
  if (!nome) return { erro: 'Escreve o nome da categoria.' };
  if (nome.length > 40) return { erro: 'Usa no máximo 40 letras.' };
  const repetida = existentes.find((outro) => chaveTexto(outro) === chaveTexto(nome)
    && !(atual !== null && chaveTexto(outro) === chaveTexto(atual)));
  if (repetida) return { erro: `Já existe a categoria "${repetida}".` };
  return { nome };
}

// Desenha a lista dentro de "caixa". obterItens() devolve a lista atual, com cada item
// { chave, nome, podeRenomear, podeApagar, detalhe }.
// aoCriar(nome) e aoRenomear(chave, nome) devolvem uma mensagem de erro, ou null se correu bem;
// aoApagar(chave) trata da confirmação e devolve true se apagou.
// "estado" guarda a categoria aberta para editar entre desenhos: { aRenomear: chave | null } (só uma de cada vez).
// "vista" é a vista onde a lista está ("mercearia" ou "gastos"), para o botão voltar do Android.
function desenharGestorCategorias(caixa, opcoes) {
  const { obterItens, estado, prefixo, vista, aoCriar, aoRenomear, aoApagar } = opcoes;
  const itens = obterItens();
  const nomes = itens.map((item) => item.nome);
  const redesenhar = () => desenharGestorCategorias(caixa, opcoes);
  if (estado.aRenomear !== null && !itens.some((item) => item.chave === estado.aRenomear)) estado.aRenomear = null;
  // Com uma categoria aberta para editar, o "voltar" do Android fecha-a, como o Cancelar.
  if (estado.aRenomear !== null) manterComVoltar(`renomear-${prefixo}`, vista, () => { estado.aRenomear = null; redesenhar(); });
  else fechadoSemVoltar(`renomear-${prefixo}`);

  const campoComErro = (id, valor, rotulo) => {
    const erro = criar('p', { id: `${id}-erro`, className: 'erro-campo', hidden: true });
    const entrada = criar('input', {
      id, type: 'text', value: valor, autocomplete: 'off', autocapitalize: 'sentences', enterKeyHint: 'done', maxLength: 40,
      'aria-describedby': `${id}-erro`, ...(rotulo ? { 'aria-label': rotulo } : {}),
    });
    entrada.addEventListener('input', () => { erro.hidden = true; entrada.removeAttribute('aria-invalid'); });
    const mostrarErro = (mensagem) => {
      erro.textContent = mensagem;
      erro.hidden = false;
      entrada.setAttribute('aria-invalid', 'true');
      entrada.focus();
    };
    return { entrada, erro, mostrarErro };
  };

  const fechar = () => { estado.aRenomear = null; redesenhar(); };
  const apagar = (item) => {
    if (!aoApagar(item.chave)) return;
    if (estado.aRenomear === item.chave) estado.aRenomear = null;
    redesenhar();
  };

  const linhas = itens.map((item) => {
    if (estado.aRenomear === item.chave) {
      // Cartão de edição: "Nome da categoria", o campo e os botões. Enter guarda e Esc cancela.
      const campo = campoComErro(`${prefixo}-renomear`, item.nome, null);
      const formulario = criar('form', { className: 'formulario-edicao', noValidate: true },
        criar('label', { htmlFor: campo.entrada.id, textContent: 'Nome da categoria' }),
        campo.entrada,
        campo.erro);
      formulario.append(botoesEdicao(formulario, { aoCancelar: fechar, aoApagar: item.podeApagar ? () => apagar(item) : null }));
      formulario.addEventListener('submit', (evento) => {
        evento.preventDefault();
        const lido = validarNomeCategoria(campo.entrada.value, nomes, item.nome);
        const erro = lido.erro || aoRenomear(item.chave, lido.nome);
        if (erro) {
          campo.mostrarErro(erro);
          return;
        }
        estado.aRenomear = null;
        redesenhar();
      });
      setTimeout(() => campo.entrada.focus(), 0);
      return criar('li', { className: 'categoria-a-editar cartao-edicao' }, formulario);
    }
    const podeEditar = item.podeRenomear || item.podeApagar;
    return criar('li', { className: 'categoria-linha' },
      criar('span', { className: 'categoria-nome' },
        item.nome,
        ...(item.detalhe ? [criar('span', { className: 'categoria-detalhe', textContent: item.detalhe })] : [])),
      // Abrir outra categoria fecha a que estava aberta, sem guardar.
      podeEditar
        ? botaoLapis(`Editar ${item.nome}`, () => {
          estado.aRenomear = item.chave;
          redesenhar();
          // A que se abriu agora é a primeira a fechar com o "voltar".
          abrirComVoltar(`renomear-${prefixo}`, vista, fechar);
        })
        // Lugar vazio do tamanho do lápis, para os nomes ficarem alinhados.
        : criar('span', { className: 'categoria-fixa', 'aria-hidden': 'true' }));
  });

  const novo = campoComErro(`${prefixo}-nova`, '', 'Nome da nova categoria');
  novo.entrada.placeholder = 'Nova categoria';
  const formularioNovo = criar('form', { className: 'categoria-nova', noValidate: true },
    novo.entrada,
    criar('button', { type: 'submit', className: 'botao-pequeno botao-pequeno-principal', textContent: 'Criar' }),
    novo.erro);
  formularioNovo.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const lido = validarNomeCategoria(novo.entrada.value, nomes);
    const erro = lido.erro || aoCriar(lido.nome);
    if (erro) {
      novo.mostrarErro(erro);
      return;
    }
    avisar(`Categoria "${lido.nome}" criada.`);
    redesenhar();
    const campo = document.getElementById(`${prefixo}-nova`);
    if (campo) campo.focus(); // o teclado fica aberto para a categoria seguinte
  });

  caixa.replaceChildren(criar('ul', { className: 'lista categorias-lista' }, ...linhas), formularioNovo);
}
