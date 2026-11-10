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

// --- Tudo o resto que a app guarda neste aparelho, para a cópia ser completa ---
// Chaves com os dados em uso: entram na cópia já limpas, nos seus campos (ver exportarCopia).
// A previsão do tempo é só uma memória do último pedido à internet e volta a ser pedida: fica de fora.
const PREFIXO_CHAVES = 'organizador-';
const CHAVE_CAMPOS_ANTIGOS = CHAVE_DADOS + '-campos-antigos';
function chavesEmUso() {
  return [CHAVE_DADOS, CHAVE_GASTOS, CHAVE_CATEGORIAS_COMPRAS, CHAVE_DESPESAS, CHAVE_CATEGORIAS_DESPESAS,
    CHAVE_COMERCIANTES, CHAVE_PRODUTOS_RECOLHIDOS, CHAVE_TEMPO];
}

// Cópias internas guardadas pela app (ex.: "…-antes-de-importar", "…-antes-da-migracao", "…-danificados"
// e os campos antigos), tal como estão, em texto. Ex.: { "organizador-dados-antes-da-migracao": "{…}" }.
function lerCopiasInternas() {
  const emUso = new Set(chavesEmUso());
  const copias = {};
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const chave = localStorage.key(i);
      if (!chave || !chave.startsWith(PREFIXO_CHAVES) || emUso.has(chave)) continue;
      const texto = localStorage.getItem(chave);
      if (typeof texto === 'string') copias[chave] = texto;
    }
  } catch (erro) { /* sem acesso ao armazenamento: a cópia segue sem elas */ }
  return copias;
}

// Campos que estão guardados nos dados mas que a app já não usa (ex.: "tarefas" de versões antigas):
// os da chave principal e os já guardados à parte. A app não os mostra, mas não se perdem.
function lerCamposAntigos() {
  const conhecidos = new Set([...Object.keys(dadosIniciais()), 'app', 'exportadoEm']);
  const antigos = {};
  try {
    const separados = JSON.parse(localStorage.getItem(CHAVE_CAMPOS_ANTIGOS) || 'null');
    if (separados && typeof separados === 'object' && !Array.isArray(separados)) Object.assign(antigos, separados);
    const brutos = JSON.parse(localStorage.getItem(CHAVE_DADOS) || 'null');
    if (brutos && typeof brutos === 'object' && !Array.isArray(brutos)) {
      Object.keys(brutos).forEach((campo) => { if (!conhecidos.has(campo)) antigos[campo] = brutos[campo]; });
    }
  } catch (erro) { /* ilegível: já ficou guardado em "…-danificados", que vai nas cópias internas */ }
  return antigos;
}

function lerPreferencias() {
  let produtosRecolhidos = null;
  try {
    produtosRecolhidos = localStorage.getItem(CHAVE_PRODUTOS_RECOLHIDOS);
  } catch (erro) { /* sem acesso: fica sem a preferência */ }
  return { produtosRecolhidos: produtosRecolhidos === 'sim' || produtosRecolhidos === 'nao' ? produtosRecolhidos : null };
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
    regrasComerciantes,
    // Desde a v35: preferências do aparelho, campos antigos que a app já não usa e as cópias internas da app.
    preferencias: lerPreferencias(),
    camposAntigos: lerCamposAntigos(),
    copiasInternas: lerCopiasInternas(),
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
  let novasRegras = null;
  // Só nas cópias feitas desde a v35; nas antigas ficam vazios e nada muda neste aparelho.
  let novasPreferencias = {};
  let novosCamposAntigos = {};
  let novasCopiasInternas = {};
  try {
    // As cópias completas levam também as cópias internas da app, por isso podem ser maiores.
    if (ficheiro.size > 20 * 1024 * 1024) throw new Error('Ficheiro grande demais');
    const bruto = JSON.parse(await ficheiro.text());
    if (bruto && bruto.app !== undefined && bruto.app !== 'organizador') throw new Error('Ficheiro de outra app');
    novos = normalizarDados(bruto);
    if (Array.isArray(bruto.gastos)) novosGastos = normalizarGastos(bruto.gastos);
    // Os campos novos, se existirem, têm de ser listas: senão o ficheiro é recusado e nada muda.
    if (bruto.categoriasCompras !== undefined) {
      if (!Array.isArray(bruto.categoriasCompras)) throw new Error('Categorias das Compras inválidas');
      novasCategoriasCompras = normalizarCategoriasCompras(bruto.categoriasCompras);
    }
    // Uma categoria "Mercearia" feita à mão numa cópia antiga passa a ser a Mercearia da app, com os seus gastos e regras.
    const [categoriasBrutas, despesasBrutas, regrasBrutas] = adotarMercearia(bruto.categoriasDespesas, bruto.despesas, bruto.regrasComerciantes);
    if (categoriasBrutas !== undefined) novasCategoriasDespesas = normalizarCategoriasDespesas(categoriasBrutas);
    if (despesasBrutas !== undefined) {
      novasDespesas = normalizarDespesas(despesasBrutas, novasCategoriasDespesas || categoriasDespesas);
    }
    if (regrasBrutas !== undefined) novasRegras = normalizarRegrasComerciantes(regrasBrutas, novasCategoriasDespesas || categoriasDespesas);
    const objeto = (valor) => valor && typeof valor === 'object' && !Array.isArray(valor);
    // Campos antigos: os que a cópia trouxer à parte e os que vierem soltos (ex.: "tarefas" numa cópia muito antiga).
    const conhecidos = new Set([...Object.keys(dadosIniciais()), 'app', 'exportadoEm', 'falhados', 'gastos', 'categoriasCompras',
      'despesas', 'categoriasDespesas', 'regrasComerciantes', 'preferencias', 'camposAntigos', 'copiasInternas']);
    if (objeto(bruto.camposAntigos)) Object.assign(novosCamposAntigos, bruto.camposAntigos);
    Object.keys(bruto).forEach((campo) => { if (!conhecidos.has(campo)) novosCamposAntigos[campo] = bruto[campo]; });
    if (objeto(bruto.preferencias) && ['sim', 'nao'].includes(bruto.preferencias.produtosRecolhidos)) {
      novasPreferencias = { produtosRecolhidos: bruto.preferencias.produtosRecolhidos };
    }
    // Cópias internas: só textos, em chaves desta app que não sejam as dos dados em uso.
    if (objeto(bruto.copiasInternas)) {
      const emUso = new Set(chavesEmUso());
      Object.entries(bruto.copiasInternas).forEach(([chave, texto]) => {
        if (chave.startsWith(PREFIXO_CHAVES) && !emUso.has(chave) && typeof texto === 'string') novasCopiasInternas[chave] = texto;
      });
    }
  } catch (erro) {
    avisar('Este ficheiro não é uma cópia válida da app. Nada foi alterado.');
    return;
  }
  const extras = [];
  if (novosGastos) extras.push(`${novosGastos.length} registos de compras`);
  if (novasDespesas) extras.push(`${novasDespesas.length} gastos gerais`);
  if (novasRegras) extras.push(`${novasRegras.length} comerciantes lembrados`);
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
    if (novasRegras) localStorage.setItem(CHAVE_COMERCIANTES + '-antes-de-importar', JSON.stringify({ versao: 1, regras: regrasComerciantes }));
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
  // Uma cópia sem regras deixa as deste aparelho, só com as categorias que ainda existem.
  regrasComerciantes = normalizarRegrasComerciantes(novasRegras || regrasComerciantes, categoriasDespesas);
  guardarRegrasComerciantes();
  restaurarExtras(novasPreferencias, novosCamposAntigos, novasCopiasInternas);
  desenharAjustes();
  atualizarTempo(); // a cópia pode ter outra localidade
  avisar('Dados importados.');
}

// Depois de importar: a preferência dos produtos, os campos antigos (juntos aos que já cá estavam) e as cópias internas
// que faltem neste aparelho. As que já cá existem não são substituídas (ex.: as "…-antes-de-importar" acabadas de fazer).
function restaurarExtras(preferencias, camposAntigos, copiasInternas) {
  try {
    if (preferencias.produtosRecolhidos) {
      localStorage.setItem(CHAVE_PRODUTOS_RECOLHIDOS, preferencias.produtosRecolhidos);
      aplicarProdutosRecolhidos(preferencias.produtosRecolhidos === 'sim');
    }
  } catch (erro) { /* sem espaço: fica a preferência deste aparelho */ }
  if (Object.keys(camposAntigos).length > 0) {
    try {
      const separados = JSON.parse(localStorage.getItem(CHAVE_CAMPOS_ANTIGOS) || 'null');
      const juntos = separados && typeof separados === 'object' && !Array.isArray(separados) ? { ...separados, ...camposAntigos } : camposAntigos;
      localStorage.setItem(CHAVE_CAMPOS_ANTIGOS, JSON.stringify(juntos));
    } catch (erro) { /* sem espaço ou ilegível: o ficheiro da cópia continua a tê-los */ }
  }
  Object.entries(copiasInternas).forEach(([chave, texto]) => {
    try {
      if (localStorage.getItem(chave) === null) localStorage.setItem(chave, texto);
    } catch (erro) { /* sem espaço: o ficheiro da cópia continua a tê-la */ }
  });
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
