// ajustes.js: ecrã Definições. Limites do ginásio e cópia de segurança dos dados.

function desenharAjustes() {
  desenharLocalidade();
  document.getElementById('ajuste-min').value = dados.ajustes.ginasioMin;
  document.getElementById('ajuste-max').value = dados.ajustes.ginasioMax;
  const estado = document.getElementById('copia-estado');
  estado.textContent = dados.ultimaCopia
    ? `Última cópia: ${new Date(dados.ultimaCopia).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}`
    : 'Ainda não foi feita nenhuma cópia neste aparelho.';
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
  const ficheiro = new File([JSON.stringify(dados, null, 2)], nome, { type: 'application/json' });

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
  desenharAjustes();
  avisar('Cópia exportada.');
}

async function restaurarCopia(ficheiro) {
  let novos;
  try {
    novos = normalizarDados(JSON.parse(await ficheiro.text()));
  } catch (erro) {
    avisar('Este ficheiro não é uma cópia válida da app. Nada foi alterado.');
    return;
  }
  const resumo = `${novos.compras.length} produtos, ${novos.suplementos.length} suplementos e ${novos.ginasio.length} dias de ginásio`;
  if (!confirm(`A cópia tem ${resumo}.\n\nOs dados atuais deste aparelho serão substituídos. Continuar?`)) return;
  dados = novos;
  guardarDados();
  desenharAjustes();
  atualizarTempo(); // a cópia pode ter outra localidade
  avisar('Cópia restaurada.');
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
