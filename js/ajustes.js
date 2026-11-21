// ajustes.js: ecrã Definições. Cópia de segurança dos dados (exportar e importar) e o nome para exportar gastos.

function desenharAjustes() {
  const estado = document.getElementById('copia-estado');
  estado.textContent = dados.ultimaCopia
    ? `Última cópia: ${new Date(dados.ultimaCopia).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}`
    : 'Ainda não foi feita nenhuma cópia neste aparelho.';
  estado.classList.toggle('resumo-falta', copiaEmFalta());
  desenharNomeExportacao();
  desenharNomesPessoas();
  desenharCasa();
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

function descarregarFicheiro(ficheiro) {
  const endereco = URL.createObjectURL(ficheiro);
  const ligacao = criar('a', { href: endereco, download: ficheiro.name });
  document.body.append(ligacao);
  ligacao.click();
  ligacao.remove();
  setTimeout(() => URL.revokeObjectURL(endereco), 10000);
}


// No iPhone e no Android abre o menu Partilhar (ex.: "Guardar em Ficheiros" ou o Google Drive); no Mac descarrega o
// ficheiro. Devolve false se o menu foi cancelado (nada foi guardado).
async function partilharFicheiro(ficheiro) {
  const temToque = navigator.maxTouchPoints > 0;
  if (temToque && navigator.canShare && navigator.canShare({ files: [ficheiro] })) {
    try {
      await navigator.share({ files: [ficheiro] });
    } catch (erro) {
      if (erro.name === 'AbortError') return false;
      descarregarFicheiro(ficheiro);
    }
  } else {
    descarregarFicheiro(ficheiro);
  }
  return true;
}

// --- Tudo o resto que a app guarda neste aparelho, para a cópia ser completa ---
// Chaves com os dados em uso: entram na cópia já limpas, nos seus campos (ver exportarCopia).
const PREFIXO_CHAVES = 'organizador-';
function chavesEmUso() {
  return [CHAVE_DADOS, CHAVE_GASTOS, CHAVE_CATEGORIAS_COMPRAS, CHAVE_DESPESAS, CHAVE_CATEGORIAS_DESPESAS,
    CHAVE_COMERCIANTES, CHAVE_FIXOS, CHAVE_PRODUTOS_RECOLHIDOS, CHAVE_GASTOS_RECOLHIDOS, CHAVE_NOME_EXPORTACAO, CHAVE_NOMES_PESSOAS, CHAVE_TEMPO_ANTIGA,
    // O código da casa é como uma chave: nunca vai na cópia. O estado da sincronização só serve neste aparelho.
    CHAVE_CASA, CHAVE_CASA_SINCRONIZACAO];
}

// Cópias internas guardadas pela app (ex.: "…-antes-de-importar", "…-antes-da-migracao", "…-antes-da-simplificacao",
// "…-danificados" e os campos antigos), tal como estão, em texto. Ex.: { "organizador-dados-antes-da-migracao": "{…}" }.
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

// Campos que a app já não usa: os guardados à parte (exercício, suplementos, jejum, "tarefas"…), os que ainda não deu
// para guardar à parte e os que estejam soltos na chave principal. A app não os mostra, mas não se perdem.
function lerCamposAntigos() {
  const antigos = {};
  try {
    Object.assign(antigos, lerCamposAntigosGuardados());
  } catch (erro) { /* ilegível: já ficou guardado em "…-danificados", que vai nas cópias internas */ }
  try {
    const brutos = JSON.parse(localStorage.getItem(CHAVE_DADOS) || 'null');
    if (brutos && typeof brutos === 'object' && !Array.isArray(brutos)) {
      const conhecidos = new Set(Object.keys(dadosIniciais()));
      Object.keys(brutos).forEach((campo) => { if (!conhecidos.has(campo)) antigos[campo] = brutos[campo]; });
    }
  } catch (erro) { /* ilegível: já ficou guardado em "…-danificados" */ }
  return { ...antigos, ...antigosPorGravar };
}

function lerPreferencias() {
  let produtosRecolhidos = null;
  let gastosRecolhidos = null;
  try {
    produtosRecolhidos = localStorage.getItem(CHAVE_PRODUTOS_RECOLHIDOS);
    gastosRecolhidos = localStorage.getItem(CHAVE_GASTOS_RECOLHIDOS);
  } catch (erro) { /* sem acesso: fica sem a preferência */ }
  const simOuNao = (valor) => (valor === 'sim' || valor === 'nao' ? valor : null);
  return {
    produtosRecolhidos: simOuNao(produtosRecolhidos),
    gastosRecolhidos: simOuNao(gastosRecolhidos), // desde a v40
    nomeExportacao: lerNomeExportacao(),
    nomesPessoas: lerNomesPessoas(), // desde a v42: nome a mostrar das pessoas dos gastos importados
  };
}

async function exportarCopia() {
  const nome = `organizador-copia-${dataParaTexto(new Date())}.json`;
  // Os dados vão tal como estão, com a data da cópia e a versão; "app" e "exportadoEm" são ignorados ao importar.
  // Os gastos, as categorias das Compras, os gastos gerais, as categorias de gastos e os comerciantes vêm das suas
  // próprias chaves e vão juntos no mesmo ficheiro.
  const copia = {
    app: 'organizador',
    exportadoEm: new Date().toISOString(),
    ...dados,
    gastos,
    categoriasCompras,
    despesas,
    categoriasDespesas,
    regrasComerciantes,
    // Desde a v48: os gastos fixos (as marcas dos meses já criados, fixosCriados, vão com os dados).
    gastosFixos: fixos,
    // Desde a v35: preferências do aparelho, campos antigos que a app já não usa e as cópias internas da app.
    preferencias: lerPreferencias(),
    camposAntigos: lerCamposAntigos(),
    copiasInternas: lerCopiasInternas(),
  };
  const ficheiro = new File([JSON.stringify(copia, null, 2)], nome, { type: 'application/json' });
  if (!(await partilharFicheiro(ficheiro))) return; // cancelado: não houve cópia

  dados.ultimaCopia = new Date().toISOString();
  guardarDados();
  if (desenhar[vistaAtual]) correrSemFalhar(desenhar[vistaAtual]);
  avisar('Dados exportados.');
}

// Campos de uma cópia que não são dos dados principais, mas que a cópia completa leva ao lado deles.
const CAMPOS_DA_COPIA = ['gastos', 'categoriasCompras', 'despesas', 'categoriasDespesas', 'regrasComerciantes', 'gastosFixos',
  'preferencias', 'camposAntigos', 'copiasInternas'];

async function restaurarCopia(ficheiro) {
  let novos;
  // null: a cópia não tem esse campo (é anterior a ele) e o que está neste aparelho fica como está.
  let novosGastos = null;
  let novasCategoriasCompras = null;
  let novasCategoriasDespesas = null;
  let novasDespesas = null;
  let novasRegras = null;
  let novosFixos = null;
  // Só nas cópias feitas desde a v35; nas antigas ficam vazios e nada muda neste aparelho.
  let novasPreferencias = {};
  let novosCamposAntigos = {};
  let novasCopiasInternas = {};
  try {
    // As cópias completas levam também as cópias internas da app, por isso podem ser maiores.
    if (ficheiro.size > 20 * 1024 * 1024) throw new Error('Ficheiro grande demais');
    const bruto = JSON.parse(await ficheiro.text());
    if (bruto && bruto.app !== undefined && bruto.app !== 'organizador') throw new Error('Ficheiro de outra app');
    // Só a lista das compras é obrigatória: as cópias de antes da simplificação (com ginásio, suplementos e jejum) também servem.
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
    // Gastos fixos (desde a v48): se existirem, têm de ser uma lista. As cópias sem eles deixam os deste aparelho.
    if (bruto.gastosFixos !== undefined) novosFixos = normalizarFixos(bruto.gastosFixos, novasCategoriasDespesas || categoriasDespesas);
    const objeto = (valor) => valor && typeof valor === 'object' && !Array.isArray(valor);
    // Campos antigos: os que a cópia trouxer à parte, os de antes da simplificação (limpos como sempre) e os que
    // vierem soltos (ex.: "tarefas" numa cópia muito antiga).
    if (objeto(bruto.camposAntigos)) Object.assign(novosCamposAntigos, bruto.camposAntigos);
    Object.assign(novosCamposAntigos, camposDesconhecidos(bruto, CAMPOS_DA_COPIA), normalizarCamposAntigos(bruto));
    if (objeto(bruto.preferencias)) {
      if (['sim', 'nao'].includes(bruto.preferencias.produtosRecolhidos)) novasPreferencias.produtosRecolhidos = bruto.preferencias.produtosRecolhidos;
      if (['sim', 'nao'].includes(bruto.preferencias.gastosRecolhidos)) novasPreferencias.gastosRecolhidos = bruto.preferencias.gastosRecolhidos;
      if (typeof bruto.preferencias.nomeExportacao === 'string') novasPreferencias.nomeExportacao = limparNomeExportacao(bruto.preferencias.nomeExportacao);
      // Só um objeto válido substitui os nomes deste aparelho; cópias sem ele deixam-nos como estão.
      const nomesPessoas = normalizarNomesPessoas(bruto.preferencias.nomesPessoas);
      if (nomesPessoas) novasPreferencias.nomesPessoas = nomesPessoas;
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
  if (novosFixos) extras.push(`${novosFixos.length} gastos fixos`);
  const resumo = `${novos.compras.length} produtos` + (extras.length ? `, ${extras.join(', ')}` : '');
  const faltam = [];
  if (!novosGastos) faltam.push('registos de compras');
  if (!novasDespesas) faltam.push('gastos gerais');
  const notaFalta = faltam.length ? `\nEsta cópia não tem ${faltam.join(' nem ')}: os deste aparelho ficam como estão.` : '';
  const notaAntigos = CAMPOS_SIMPLIFICADOS.some((c) => c in novosCamposAntigos)
    ? '\nO exercício, os suplementos e o jejum desta cópia ficam guardados à parte (não aparecem na app).'
    : '';
  if (!confirm(`A cópia tem ${resumo}.\n\nOs dados atuais deste aparelho serão substituídos. Continuar?${notaFalta}${notaAntigos}`)) return;
  // Guarda os dados de antes à parte, para não se perderem se a cópia escolhida for a errada.
  try {
    localStorage.setItem(CHAVE_DADOS + '-antes-de-importar', JSON.stringify(dados));
    if (Object.keys(novosCamposAntigos).length > 0) {
      localStorage.setItem(CHAVE_CAMPOS_ANTIGOS + '-antes-de-importar', JSON.stringify(lerCamposAntigos()));
    }
    if (novosGastos) localStorage.setItem(CHAVE_GASTOS + '-antes-de-importar', JSON.stringify({ versao: 1, registos: gastos }));
    localStorage.setItem(CHAVE_CATEGORIAS_COMPRAS + '-antes-de-importar', JSON.stringify({ versao: 1, categorias: categoriasCompras }));
    if (novasDespesas || novasCategoriasDespesas) {
      localStorage.setItem(CHAVE_DESPESAS + '-antes-de-importar', JSON.stringify({ versao: 1, registos: despesas }));
      localStorage.setItem(CHAVE_CATEGORIAS_DESPESAS + '-antes-de-importar', JSON.stringify({ versao: 1, categorias: categoriasDespesas }));
    }
    if (novasRegras) localStorage.setItem(CHAVE_COMERCIANTES + '-antes-de-importar', JSON.stringify({ versao: 1, regras: regrasComerciantes }));
    if (novosFixos) localStorage.setItem(CHAVE_FIXOS + '-antes-de-importar', JSON.stringify({ versao: 1, fixos }));
  } catch (erro) { /* sem espaço: segue na mesma, o utilizador já confirmou */ }
  // Primeiro os campos antigos (se não der para os guardar à parte, vão com os dados principais) e só depois os dados.
  if (!juntarCamposAntigos(novosCamposAntigos)) antigosPorGravar = { ...antigosPorGravar, ...novosCamposAntigos };
  // Com uma casa ligada, a lista importada não substitui a da nuvem: junta-se com ela no fim (casa.js).
  pausarSincronizacao();
  // Os meses já criados pelos gastos fixos juntam-se aos deste aparelho (nunca se esquecem): restaurar uma cópia, antiga
  // ou nova, não volta a criar um mês que já tenha sido criado aqui ou no aparelho da cópia.
  novos.fixosCriados = { ...novos.fixosCriados, ...dados.fixosCriados };
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
  // Uma cópia sem gastos fixos deixa os deste aparelho, só com as categorias que ainda existem.
  fixos = normalizarFixos(novosFixos || fixos, categoriasDespesas);
  guardarFixos();
  restaurarExtras(novasPreferencias, novasCopiasInternas);
  retomarDepoisDeImportar();
  // Os meses devidos que ainda não foram criados em nenhum dos dois (ex.: uma cópia feita antes do dia de um fixo).
  const criados = criarGastosFixosDevidos();
  if (criados.length) mostrarResultadoGastos(textoFixosCriados(criados));
  desenharAjustes();
  avisar('Dados importados.');
}

// Depois de importar: as preferências e as cópias internas que faltem neste aparelho. As que já cá existem não são
// substituídas (ex.: as "…-antes-de-importar" acabadas de fazer). A memória da previsão do tempo já não se usa.
function restaurarExtras(preferencias, copiasInternas) {
  try {
    if (preferencias.produtosRecolhidos) {
      localStorage.setItem(CHAVE_PRODUTOS_RECOLHIDOS, preferencias.produtosRecolhidos);
      aplicarProdutosRecolhidos(preferencias.produtosRecolhidos === 'sim');
    }
  } catch (erro) { /* sem espaço: fica a preferência deste aparelho */ }
  // Já não se usa no ecrã (a lista agrupa-se por categoria), mas continua guardada, para as cópias seguintes a levarem.
  if (preferencias.gastosRecolhidos) guardarGastosRecolhidos(preferencias.gastosRecolhidos === 'sim');
  if (preferencias.nomeExportacao !== undefined) guardarNomeExportacao(preferencias.nomeExportacao);
  if (preferencias.nomesPessoas) guardarNomesPessoas(preferencias.nomesPessoas);
  Object.entries(copiasInternas).forEach(([chave, texto]) => {
    if (chave === CHAVE_TEMPO_ANTIGA) return;
    try {
      if (localStorage.getItem(chave) === null) localStorage.setItem(chave, texto);
    } catch (erro) { /* sem espaço: o ficheiro da cópia continua a tê-la */ }
  });
}

document.getElementById('copia-exportar').addEventListener('click', exportarCopia);
document.getElementById('copia-importar').addEventListener('change', async (evento) => {
  const ficheiro = evento.target.files[0];
  evento.target.value = ''; // permite escolher o mesmo ficheiro outra vez
  if (ficheiro) await restaurarCopia(ficheiro);
});

desenhar.ajustes = desenharAjustes;
