// ajustes.js: ecrã Definições. Limites do ginásio e cópia de segurança dos dados.

function desenharAjustes() {
  desenharLocalidade();
  document.getElementById('ajuste-min').value = dados.ajustes.ginasioMin;
  document.getElementById('ajuste-max').value = dados.ajustes.ginasioMax;
  const estado = document.getElementById('copia-estado');
  estado.textContent = dados.ultimaCopia
    ? `Última cópia: ${new Date(dados.ultimaCopia).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}`
    : 'Ainda não foi feita nenhuma cópia neste aparelho.';
  estado.classList.toggle('resumo-falta', copiaEmFalta());
}

const DIAS_ENTRE_COPIAS = 30;

// Dias desde a última cópia exportada; null se nunca houve nenhuma.
function diasDesdeCopia() {
  if (!dados.ultimaCopia) return null;
  return Math.floor((Date.now() - Date.parse(dados.ultimaCopia)) / (24 * 60 * 60 * 1000));
}

function copiaEmFalta() {
  const dias = diasDesdeCopia();
  return dias === null || dias > DIAS_ENTRE_COPIAS;
}

// Texto do lembrete, ou null se a cópia estiver em dia.
function textoLembreteCopia() {
  if (!copiaEmFalta()) return null;
  const dias = diasDesdeCopia();
  return dias === null ? 'Ainda não há cópia de segurança dos dados.' : `Última cópia de segurança há ${dias} dias.`;
}

// Mantém os limites válidos: de 0 a 5, com o mínimo nunca acima do máximo.
function alterarLimite(campo) {
  const valor = Number(document.getElementById(`ajuste-${campo}`).value);
  const menorPermitido = campo === 'min' ? 0 : 1;
  if (!Number.isInteger(valor) || valor < menorPermitido || valor > 5) {
    avisar(`Escolhe um número inteiro de ${menorPermitido} a 5.`);
    desenharAjustes();
    return;
  }
  if (campo === 'min') {
    dados.ajustes.ginasioMin = valor;
    dados.ajustes.ginasioMax = Math.max(valor, dados.ajustes.ginasioMax, 1);
  } else {
    dados.ajustes.ginasioMax = valor;
    dados.ajustes.ginasioMin = Math.min(valor, dados.ajustes.ginasioMin);
  }
  guardarDados();
  desenharAjustes();
}

function descarregarFicheiro(ficheiro) {
  const endereco = URL.createObjectURL(ficheiro);
  const ligacao = criar('a', { href: endereco, download: ficheiro.name });
  document.body.append(ligacao);
  ligacao.click();
  ligacao.remove();
  setTimeout(() => URL.revokeObjectURL(endereco), 10000);
}

async function exportarCopia() {
  const nome = `organizador-copia-${dataParaTexto(new Date())}.json`;
  // Os dados vão tal como estão, com a data da cópia e a versão; "app" e "exportadoEm" são ignorados ao importar.
  // Os gastos vêm da sua própria chave (ver gastos.js) e vão juntos no mesmo ficheiro.
  // O mesmo para as categorias das Compras, os gastos gerais e as categorias de gastos.
  const copia = {
    app: 'organizador',
    exportadoEm: new Date().toISOString(),
    ...dados,
    gastos,
    categoriasCompras,
    despesas,
    categoriasDespesas,
  };
  const ficheiro = new File([JSON.stringify(copia, null, 2)], nome, { type: 'application/json' });

  // No iPhone abre o menu Partilhar (ex.: "Guardar em Ficheiros"); no Mac descarrega o ficheiro.
  const temToque = navigator.maxTouchPoints > 0;
  if (temToque && navigator.canShare && navigator.canShare({ files: [ficheiro] })) {
    try {
      await navigator.share({ files: [ficheiro] });
    } catch (erro) {
      if (erro.name === 'AbortError') return; // cancelado: não houve cópia
      descarregarFicheiro(ficheiro);
    }
  } else {
    descarregarFicheiro(ficheiro);
  }

  dados.ultimaCopia = new Date().toISOString();
  guardarDados();
  if (desenhar[vistaAtual]) correrSemFalhar(desenhar[vistaAtual]);
  avisar('Dados exportados.');
}

async function restaurarCopia(ficheiro) {
  let novos;
  // null: a cópia não tem esse campo (é anterior a ele) e o que está neste aparelho fica como está.
  let novosGastos = null;
  let novasCategoriasCompras = null;
  let novasCategoriasDespesas = null;
  let novasDespesas = null;
  try {
    if (ficheiro.size > 5 * 1024 * 1024) throw new Error('Ficheiro grande demais');
    const bruto = JSON.parse(await ficheiro.text());
    if (bruto && bruto.app !== undefined && bruto.app !== 'organizador') throw new Error('Ficheiro de outra app');
    novos = normalizarDados(bruto);
    if (Array.isArray(bruto.gastos)) novosGastos = normalizarGastos(bruto.gastos);
    // Os campos novos, se existirem, têm de ser listas: senão o ficheiro é recusado e nada muda.
    if (bruto.categoriasCompras !== undefined) {
      if (!Array.isArray(bruto.categoriasCompras)) throw new Error('Categorias das Compras inválidas');
      novasCategoriasCompras = normalizarCategoriasCompras(bruto.categoriasCompras);
    }
    if (bruto.categoriasDespesas !== undefined) novasCategoriasDespesas = normalizarCategoriasDespesas(bruto.categoriasDespesas);
    if (bruto.despesas !== undefined) {
      novasDespesas = normalizarDespesas(bruto.despesas, novasCategoriasDespesas || categoriasDespesas);
    }
  } catch (erro) {
    avisar('Este ficheiro não é uma cópia válida da app. Nada foi alterado.');
    return;
  }
  const extras = [];
  if (novosGastos) extras.push(`${novosGastos.length} registos de compras`);
  if (novasDespesas) extras.push(`${novasDespesas.length} gastos gerais`);
  const resumo = `${novos.compras.length} produtos, ${novos.suplementos.length} suplementos, ${novos.ginasio.length} dias de ginásio`
    + (extras.length ? `, ${extras.join(', ')}` : '');
  const faltam = [];
  if (!novosGastos) faltam.push('registos de compras');
  if (!novasDespesas) faltam.push('gastos gerais');
  const notaFalta = faltam.length ? `\nEsta cópia não tem ${faltam.join(' nem ')}: os deste aparelho ficam como estão.` : '';
  if (!confirm(`A cópia tem ${resumo}.\n\nOs dados atuais deste aparelho serão substituídos. Continuar?${notaFalta}`)) return;
  // Guarda os dados de antes à parte, para não se perderem se a cópia escolhida for a errada.
  try {
    localStorage.setItem(CHAVE_DADOS + '-antes-de-importar', JSON.stringify(dados));
    if (novosGastos) localStorage.setItem(CHAVE_GASTOS + '-antes-de-importar', JSON.stringify({ versao: 1, registos: gastos }));
    localStorage.setItem(CHAVE_CATEGORIAS_COMPRAS + '-antes-de-importar', JSON.stringify({ versao: 1, categorias: categoriasCompras }));
    if (novasDespesas || novasCategoriasDespesas) {
      localStorage.setItem(CHAVE_DESPESAS + '-antes-de-importar', JSON.stringify({ versao: 1, registos: despesas }));
      localStorage.setItem(CHAVE_CATEGORIAS_DESPESAS + '-antes-de-importar', JSON.stringify({ versao: 1, categorias: categoriasDespesas }));
    }
  } catch (erro) { /* sem espaço: segue na mesma, o utilizador já confirmou */ }
  dados = novos;
  guardarDados();
  if (novosGastos) {
    gastos = novosGastos;
    guardarGastos();
  }
  // Uma cópia antiga não tem a lista de categorias: fica a deste aparelho, completada com as que os produtos usam.
  categoriasCompras = completarCategoriasCompras(novasCategoriasCompras || categoriasCompras);
  guardarCategoriasCompras();
  if (novasCategoriasDespesas) {
    categoriasDespesas = novasCategoriasDespesas;
    guardarCategoriasDespesas();
  }
  // Os gastos deste aparelho (se a cópia não os tiver) também ficam a apontar só para categorias que existem.
  despesas = normalizarDespesas(novasDespesas || despesas, categoriasDespesas);
  guardarDespesas();
  desenharAjustes();
  atualizarTempo(); // a cópia pode ter outra localidade
  avisar('Dados importados.');
}

document.getElementById('ajuste-min').addEventListener('change', () => alterarLimite('min'));
document.getElementById('ajuste-max').addEventListener('change', () => alterarLimite('max'));
document.getElementById('copia-exportar').addEventListener('click', exportarCopia);
document.getElementById('copia-importar').addEventListener('change', async (evento) => {
  const ficheiro = evento.target.files[0];
  evento.target.value = ''; // permite escolher o mesmo ficheiro outra vez
  if (ficheiro) await restaurarCopia(ficheiro);
});

desenhar.ajustes = desenharAjustes;
