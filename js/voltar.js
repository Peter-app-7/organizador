// voltar.js: botão (ou gesto) "voltar" do Android. Com um formulário ou uma edição aberta na vista em que se está,
// "voltar" fecha-o em vez de sair da app. Para isso, enquanto houver algo aberto nessa vista, a app junta uma entrada
// ao histórico do navegador (history.pushState); "voltar" tira-a e fecha o que foi aberto por último.
// No iPhone não há botão voltar: as entradas do histórico não mudam nada no que se vê.

const ESTADO_VOLTAR = 'organizador-aberto';
const abertosComVoltar = []; // { chave, vista, fechar }, pela ordem em que abriram
let popsAIgnorar = 0; // "voltar" feitos pela própria app (ao fechar com Cancelar ou Guardar)

function estaNaEntradaDaApp() {
  return Boolean(history.state && history.state[ESTADO_VOLTAR]);
}

// Mantém uma entrada no histórico só enquanto houver algo aberto na vista atual.
function acertarVoltar() {
  const precisa = abertosComVoltar.some((a) => a.vista === vistaAtual);
  if (precisa && !estaNaEntradaDaApp()) {
    history.pushState({ [ESTADO_VOLTAR]: true }, '');
  } else if (!precisa && estaNaEntradaDaApp() && popsAIgnorar === 0) {
    popsAIgnorar += 1;
    history.back();
  }
}

// "chave" identifica o que abriu (ex.: "registar-gasto"); abrir outra vez a mesma só a passa para o topo.
function abrirComVoltar(chave, vista, fechar) {
  const indice = abertosComVoltar.findIndex((a) => a.chave === chave);
  if (indice !== -1) abertosComVoltar.splice(indice, 1);
  abertosComVoltar.push({ chave, vista, fechar });
  acertarVoltar();
}

// Fechou por outro caminho (Cancelar, Guardar, mudar de período…): deixa de ser preciso tratar do "voltar".
function fechadoSemVoltar(chave) {
  const indice = abertosComVoltar.findIndex((a) => a.chave === chave);
  if (indice === -1) return;
  abertosComVoltar.splice(indice, 1);
  acertarVoltar();
}

window.addEventListener('popstate', () => {
  if (popsAIgnorar > 0) {
    popsAIgnorar -= 1;
    acertarVoltar(); // entretanto pode ter aberto outra coisa
    return;
  }
  // Fecha o último aberto na vista atual.
  for (let i = abertosComVoltar.length - 1; i >= 0; i -= 1) {
    if (abertosComVoltar[i].vista !== vistaAtual) continue;
    const [aberto] = abertosComVoltar.splice(i, 1);
    correrSemFalhar(aberto.fechar);
    break;
  }
  acertarVoltar();
});

// Ao recarregar a página, uma entrada antiga da app deixa de contar (nada está aberto).
if (estaNaEntradaDaApp()) history.replaceState(null, '');
