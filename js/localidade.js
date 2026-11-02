// localidade.js: escolher, em Definições, a localidade da previsão do tempo.
// A escolha fica só nos dados guardados no aparelho.

function desenharLocalidade() {
  const atual = document.getElementById('localidade-atual');
  const localidade = dados.localidade;
  atual.textContent = localidade
    ? `Atual: ${[localidade.nome, localidade.regiao].filter(Boolean).join(', ')}`
    : 'Ainda não escolheste a localidade.';
}

function escolherLocalidade(resultado) {
  dados.localidade = {
    nome: resultado.name,
    regiao: [resultado.admin2, resultado.admin1].filter(Boolean).join(', '),
    latitude: resultado.latitude,
    longitude: resultado.longitude,
  };
  guardarDados();
  document.getElementById('localidade-resultados').replaceChildren();
  document.getElementById('localidade-nome').value = '';
  desenharLocalidade();
  atualizarTempo();
}

async function procurarLocalidade(nome) {
  const lista = document.getElementById('localidade-resultados');
  const botao = document.getElementById('localidade-procurar');
  lista.replaceChildren();
  botao.disabled = true;
  try {
    const resposta = await fetch('https://geocoding-api.open-meteo.com/v1/search'
      + `?name=${encodeURIComponent(nome)}&count=8&language=pt&countryCode=PT`);
    if (!resposta.ok) throw new Error(`Erro ${resposta.status}`);
    const { results } = await resposta.json();
    const validos = (results || []).filter((r) => r.name
      && Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
    if (validos.length === 0) {
      avisar('Não encontrei essa localidade em Portugal.');
      return;
    }
    // Pode haver várias localidades com o mesmo nome: mostra a região para distinguir.
    lista.append(...validos.map((resultado) => criar('li', {}, criar('button', {
      type: 'button',
      className: 'botao-secundario',
      textContent: [resultado.name, resultado.admin2, resultado.admin1].filter(Boolean).join(', '),
      onclick: () => escolherLocalidade(resultado),
    }))));
  } catch (erro) {
    avisar('Não foi possível procurar agora. Tenta mais tarde.');
  } finally {
    botao.disabled = false;
  }
}

document.getElementById('localidade-formulario').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const nome = document.getElementById('localidade-nome').value.trim();
  if (nome) procurarLocalidade(nome);
});
