// categorias.js: lista de categorias que se edita no ecrã (criar, renomear e apagar).
// Usada pelas categorias das Compras (compras.js) e pelas categorias dos gastos (despesas.js).

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
// "estado" guarda a categoria a ser renomeada entre desenhos: { aRenomear: chave | null }.
function desenharGestorCategorias(caixa, opcoes) {
  const { obterItens, estado, prefixo, aoCriar, aoRenomear, aoApagar } = opcoes;
  const itens = obterItens();
  const nomes = itens.map((item) => item.nome);
  const redesenhar = () => desenharGestorCategorias(caixa, opcoes);

  const campoComErro = (id, valor, rotulo) => {
    const erro = criar('p', { id: `${id}-erro`, className: 'erro-campo', hidden: true });
    const entrada = criar('input', {
      id, type: 'text', value: valor, autocomplete: 'off', autocapitalize: 'sentences', enterKeyHint: 'done', maxLength: 40,
      'aria-label': rotulo, 'aria-describedby': `${id}-erro`,
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

  const linhas = itens.map((item) => {
    if (estado.aRenomear === item.chave) {
      const campo = campoComErro(`${prefixo}-renomear`, item.nome, `Novo nome para ${item.nome}`);
      const formulario = criar('form', { className: 'categoria-renomear', noValidate: true },
        campo.entrada,
        criar('div', { className: 'categoria-botoes' },
          criar('button', { type: 'submit', className: 'botao-pequeno botao-pequeno-principal', textContent: 'Guardar' }),
          criar('button', { type: 'button', className: 'botao-pequeno', textContent: 'Cancelar', onclick: () => { estado.aRenomear = null; redesenhar(); } })),
        campo.erro);
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
      return criar('li', { className: 'categoria-linha categoria-a-editar' }, formulario);
    }
    return criar('li', { className: 'categoria-linha' },
      criar('span', { className: 'categoria-nome' },
        item.nome,
        ...(item.detalhe ? [criar('span', { className: 'categoria-detalhe', textContent: item.detalhe })] : [])),
      ...(item.podeRenomear ? [criar('button', {
        type: 'button', className: 'botao-pequeno', textContent: 'Renomear', 'aria-label': `Renomear ${item.nome}`,
        onclick: () => { estado.aRenomear = item.chave; redesenhar(); },
      })] : []),
      item.podeApagar
        ? botaoApagar(`a categoria ${item.nome}`, () => {
          if (aoApagar(item.chave)) {
            if (estado.aRenomear === item.chave) estado.aRenomear = null;
            redesenhar();
          }
        })
        // Lugar vazio do tamanho do ✕, para os botões ficarem alinhados.
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
