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

// Controlo de duas opções (ex.: "Da casa" / "Pessoal"): um rótulo e dois botões de 44 px com aria-pressed, num grupo com
// aria-labelledby. "opcoes" = [[valor, texto], [valor, texto]]. aoMudar(valor) só corre quando se toca num botão.
// Devolve { elemento, valor(), definir(valor) }.
function escolhaDeDuas({ id, rotulo, opcoes, valor, aoMudar }) {
  let atual = valor;
  const botoes = opcoes.map(([v, texto]) => criar('button', {
    type: 'button',
    textContent: texto,
    'aria-pressed': String(v === atual),
    onclick: () => {
      definir(v);
      if (aoMudar) aoMudar(v);
    },
  }));
  function definir(v) {
    atual = v;
    botoes.forEach((botao, i) => botao.setAttribute('aria-pressed', String(opcoes[i][0] === v)));
  }
  const elemento = criar('div', { className: 'escolha-duas-caixa' },
    criar('span', { id: `${id}-rotulo`, className: 'escolha-duas-rotulo', textContent: rotulo }),
    criar('div', { className: 'escolha-duas', 'aria-labelledby': `${id}-rotulo` }, ...botoes));
  elemento.querySelector('.escolha-duas').setAttribute('role', 'group');
  return { elemento, valor: () => atual, definir };
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

// Campo de texto de um nome de categoria (até 40 letras), com a mensagem de erro por baixo, que se esconde ao escrever.
function campoCategoriaComErro(id, valor, rotulo) {
  const erro = criar('p', { id: `${id}-erro`, className: 'erro-campo', hidden: true });
  const entrada = criar('input', {
    id, type: 'text', value: valor, autocomplete: 'off', autocapitalize: 'sentences', enterKeyHint: 'done', maxLength: 40,
    'aria-describedby': `${id}-erro`, ...(rotulo ? { 'aria-label': rotulo } : {}),
  });
  entrada.addEventListener('input', () => { erro.hidden = true; entrada.removeAttribute('aria-invalid'); });
  const mostrarErro = (mensagem) => {
    erro.classList.add('erro-campo');
    erro.textContent = mensagem;
    erro.hidden = false;
    entrada.setAttribute('aria-invalid', 'true');
    entrada.focus();
  };
  return { entrada, erro, mostrarErro };
}

// Linha "Nova categoria…", com o aspeto da linha "Adicionar produto" da Mercearia: campo de 48 px e botão "+" de
// 48 x 48 px; a mensagem fica por baixo da linha até se voltar a escrever. obterNomes() devolve os nomes atuais;
// aoCriar(nome) devolve uma mensagem de erro, ou null se correu bem; depois corre aoCriada(nome, campo).
// aoErro() (opcional) corre depois de mostrar um erro (ex.: nos Gastos, para a mensagem ficar acima da barra do total).
// "rotulo": texto visível por cima da linha (ex.: nos Gastos); sem ele, o rótulo "Nova categoria" fica escondido.
function formularioNovaCategoria({ prefixo, obterNomes, aoCriar, aoCriada, aoErro, rotulo }) {
  const novo = campoCategoriaComErro(`${prefixo}-nova`, '', null);
  novo.entrada.placeholder = 'Nova categoria…';
  novo.erro.classList.add('mensagem-adicionar');
  novo.erro.setAttribute('role', 'status');
  const mais = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  mais.setAttribute('class', 'icone-traco');
  mais.setAttribute('viewBox', '0 0 24 24');
  mais.setAttribute('width', '22');
  mais.setAttribute('height', '22');
  mais.setAttribute('aria-hidden', 'true');
  mais.setAttribute('focusable', 'false');
  ['M12 5v14', 'M5 12h14'].forEach((d) => {
    const caminho = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    caminho.setAttribute('d', d);
    mais.append(caminho);
  });
  const formulario = criar('form', { className: 'categoria-nova', noValidate: true },
    criar('label', { htmlFor: novo.entrada.id, className: rotulo ? 'categoria-nova-rotulo' : 'so-leitor', textContent: rotulo || 'Nova categoria' }),
    novo.entrada,
    criar('button', { type: 'submit', className: 'botao-mais', 'aria-label': 'Criar categoria' }, mais),
    novo.erro);
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const lido = validarNomeCategoria(novo.entrada.value, obterNomes());
    const erro = lido.erro || aoCriar(lido.nome);
    if (erro) {
      novo.mostrarErro(erro);
      if (aoErro) aoErro();
      return;
    }
    aoCriada(lido.nome, novo);
  });
  return formulario;
}

// Desenha a lista dentro de "caixa". obterItens() devolve a lista atual, com cada item
// { chave, nome, podeRenomear, podeApagar, detalhe, etiqueta } ("etiqueta": texto pequeno ao lado do nome, ex.: "Pessoal").
// aoCriar(nome) e aoRenomear(chave, nome, extra) devolvem uma mensagem de erro, ou null se correu bem;
// "campoExtra(item)" (opcional) devolve { elemento, valor() } para pôr no cartão por baixo do nome (ex.: o tipo das
// categorias de gastos), ou null; o valor() chega a aoRenomear como "extra" e é guardado com o nome.

// aoApagar(chave) trata da confirmação e devolve true se apagou.
// "estado" guarda a categoria aberta para editar entre desenhos: { aRenomear: chave | null } (só uma de cada vez).
// "vista" é a vista onde a lista está ("mercearia" ou "gastos"), para o botão voltar do Android.
function desenharGestorCategorias(caixa, opcoes) {
  const { obterItens, estado, prefixo, vista, aoCriar, aoRenomear, aoApagar, campoExtra } = opcoes;
  const itens = obterItens();
  const nomes = itens.map((item) => item.nome);
  const redesenhar = () => desenharGestorCategorias(caixa, opcoes);
  if (estado.aRenomear !== null && !itens.some((item) => item.chave === estado.aRenomear)) estado.aRenomear = null;
  // Com uma categoria aberta para editar, o "voltar" do Android fecha-a, como o Cancelar.
  if (estado.aRenomear !== null) manterComVoltar(`renomear-${prefixo}`, vista, () => { estado.aRenomear = null; redesenhar(); });
  else fechadoSemVoltar(`renomear-${prefixo}`);

  const fechar = () => { estado.aRenomear = null; redesenhar(); };
  const apagar = (item) => {
    if (!aoApagar(item.chave)) return;
    if (estado.aRenomear === item.chave) estado.aRenomear = null;
    redesenhar();
  };

  const linhas = itens.map((item) => {
    if (estado.aRenomear === item.chave) {
      // Cartão de edição: "Nome da categoria", o campo e os botões. Enter guarda e Esc cancela.
      const campo = campoCategoriaComErro(`${prefixo}-renomear`, item.nome, null);
      const formulario = criar('form', { className: 'formulario-edicao', noValidate: true },
        criar('label', { htmlFor: campo.entrada.id, textContent: 'Nome da categoria' }),
        campo.entrada,
        campo.erro);
      const extra = campoExtra ? campoExtra(item) : null;
      if (extra) formulario.append(extra.elemento);
      formulario.append(botoesEdicao(formulario, { aoCancelar: fechar, aoApagar: item.podeApagar ? () => apagar(item) : null }));
      formulario.addEventListener('submit', (evento) => {
        evento.preventDefault();
        const lido = validarNomeCategoria(campo.entrada.value, nomes, item.nome);
        const erro = lido.erro || aoRenomear(item.chave, lido.nome, extra ? extra.valor() : undefined);
        if (erro) {
          campo.mostrarErro(erro);
          return;
        }
        estado.aRenomear = null;
        redesenhar();
      });
      setTimeout(() => campo.entrada.focus(vista === 'gastos' ? { preventScroll: true } : undefined), 0);
      return criar('li', { className: 'categoria-a-editar cartao-edicao' }, formulario);
    }
    const podeEditar = item.podeRenomear || item.podeApagar;
    return criar('li', { className: 'categoria-linha' },
      criar('span', { className: 'categoria-nome' },
        item.nome,
        ...(item.etiqueta ? [' ', criar('span', { className: 'categoria-etiqueta', textContent: item.etiqueta })] : []),
        ...(item.detalhe ? [criar('span', { className: 'categoria-detalhe', textContent: item.detalhe })] : [])),
      // Abrir outra categoria fecha a que estava aberta, sem guardar.
      podeEditar
        ? botaoLapis(`Editar ${item.nome}`, () => {
          estado.aRenomear = item.chave;
          redesenhar();
          // A que se abriu agora é a primeira a fechar com o "voltar".
          abrirComVoltar(`renomear-${prefixo}`, vista, fechar);
          // Nos Gastos (no fim da vista), o cartão fica inteiro à vista, acima da barra do total.
          if (vista === 'gastos') mostrarAcimaDasBarras(caixa.querySelector('.cartao-edicao'));
        })
        // Lugar vazio do tamanho do lápis, para os nomes ficarem alinhados.
        : criar('span', { className: 'categoria-fixa', 'aria-hidden': 'true' }));
  });

  // "semLinhaNova": a linha "Nova categoria…" está noutro sítio (nos Gastos, no fim da vista, sempre à vista).
  if (opcoes.semLinhaNova) {
    caixa.replaceChildren(criar('ul', { className: 'lista categorias-lista' }, ...linhas));
    return;
  }
  const formularioNovo = formularioNovaCategoria({
    prefixo,
    obterNomes: () => nomes,
    aoCriar,
    aoCriada: (nome) => {
      avisar(`Categoria "${nome}" criada.`);
      redesenhar();
      const campo = document.getElementById(`${prefixo}-nova`);
      if (campo) campo.focus(); // o teclado fica aberto para a categoria seguinte
    },
  });

  caixa.replaceChildren(criar('ul', { className: 'lista categorias-lista' }, ...linhas), formularioNovo);
}
