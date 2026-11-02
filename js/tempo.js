// tempo.js: previsão do tempo para a localidade escolhida em Definições, do serviço gratuito Open-Meteo.

const CHAVE_TEMPO = 'organizador-tempo';
const TRINTA_MINUTOS = 30 * 60 * 1000;
const TRES_HORAS = 3 * 60 * 60 * 1000;

let previsaoFalhou = false; // sem internet, ou o serviço não respondeu

function urlTempo(localidade) {
  return 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${localidade.latitude}&longitude=${localidade.longitude}`
    + '&current=temperature_2m,weather_code'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    + '&timezone=auto&forecast_days=7';
}

// Códigos meteorológicos internacionais (WMO) usados pelo Open-Meteo.
function descreverTempo(codigo) {
  if (codigo === 0) return { texto: 'Céu limpo', icone: '☀️' };
  if (codigo === 1) return { texto: 'Pouco nublado', icone: '🌤️' };
  if (codigo === 2) return { texto: 'Parcialmente nublado', icone: '⛅' };
  if (codigo === 3) return { texto: 'Nublado', icone: '☁️' };
  if (codigo === 45 || codigo === 48) return { texto: 'Nevoeiro', icone: '🌫️' };
  if (codigo >= 51 && codigo <= 57) return { texto: 'Chuvisco', icone: '🌦️' };
  if (codigo >= 61 && codigo <= 67) return { texto: 'Chuva', icone: '🌧️' };
  if (codigo >= 71 && codigo <= 77) return { texto: 'Neve', icone: '🌨️' };
  if (codigo >= 80 && codigo <= 82) return { texto: 'Aguaceiros', icone: '🌦️' };
  if (codigo >= 85 && codigo <= 86) return { texto: 'Aguaceiros de neve', icone: '🌨️' };
  if (codigo >= 95) return { texto: 'Trovoada', icone: '⛈️' };
  return { texto: 'Sem descrição', icone: '🌡️' };
}

// Só devolve a previsão guardada se for da localidade atual.
function lerTempoGuardado() {
  const localidade = dados.localidade;
  if (!localidade) return null;
  try {
    const guardado = JSON.parse(localStorage.getItem(CHAVE_TEMPO));
    const mesmoSitio = guardado
      && guardado.latitude === localidade.latitude
      && guardado.longitude === localidade.longitude;
    return mesmoSitio ? guardado : null;
  } catch (erro) {
    return null;
  }
}

function desenharTempo() {
  const agora = document.getElementById('tempo-agora');
  const caixaDias = document.getElementById('tempo-dias');
  caixaDias.replaceChildren();

  const localidade = dados.localidade;
  if (!localidade) {
    agora.textContent = 'Escolhe a localidade em ⚙️';
    return;
  }

  const guardado = lerTempoGuardado();
  const diario = guardado && guardado.previsao && guardado.previsao.daily;
  const hoje = dataParaTexto(new Date());
  // Mostra só o dia de hoje. A previsão guardada tem mais dias, para servir sem internet nos dias seguintes.
  const indiceHoje = diario ? diario.time.indexOf(hoje) : -1;

  if (indiceHoje === -1) {
    agora.textContent = `${localidade.nome} · ${previsaoFalhou ? 'previsão indisponível' : 'a carregar…'}`;
    return;
  }

  const recente = Date.now() - guardado.obtidoEm < TRES_HORAS;
  const atual = guardado.previsao.current;

  if (recente && atual) {
    const estado = descreverTempo(atual.weather_code);
    agora.replaceChildren(
      `${localidade.nome} `,
      criar('span', { className: 'tempo-temperatura', textContent: `${Math.round(atual.temperature_2m)}°` }),
      ` ${estado.icone} ${estado.texto}`,
    );
  } else {
    const estado = descreverTempo(diario.weather_code[indiceHoje]);
    agora.textContent = `${localidade.nome} ${estado.icone} ${estado.texto}`;
  }

  const minima = Math.round(diario.temperature_2m_min[indiceHoje]);
  const maxima = Math.round(diario.temperature_2m_max[indiceHoje]);
  const chuva = diario.precipitation_probability_max[indiceHoje];
  const textoChuva = chuva === null || chuva === undefined ? '' : ` · 💧${chuva}%`;
  caixaDias.append(criar('span', { textContent: `Hoje ${minima}°–${maxima}°${textoChuva}` }));

  if (previsaoFalhou) {
    const quando = new Date(guardado.obtidoEm).toLocaleString('pt-PT', {
      day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    caixaDias.append(criar('span', { className: 'tempo-nota', textContent: `Não foi possível atualizar. Previsão de ${quando}.` }));
  }
}

async function atualizarTempo() {
  previsaoFalhou = false;
  desenharTempo();
  const localidade = dados.localidade;
  if (!localidade) return;
  const guardado = lerTempoGuardado();
  const diario = guardado && guardado.previsao && guardado.previsao.daily;
  const temHoje = Boolean(diario && diario.time.includes(dataParaTexto(new Date())));
  if (temHoje && Date.now() - guardado.obtidoEm < TRINTA_MINUTOS) return;

  try {
    const resposta = await fetch(urlTempo(localidade));
    if (!resposta.ok) throw new Error(`Erro ${resposta.status}`);
    const previsao = await resposta.json();
    if (!previsao.daily || !Array.isArray(previsao.daily.time)) throw new Error('Resposta inesperada');
    localStorage.setItem(CHAVE_TEMPO, JSON.stringify({
      obtidoEm: Date.now(),
      latitude: localidade.latitude,
      longitude: localidade.longitude,
      previsao,
    }));
  } catch (erro) {
    previsaoFalhou = true;
  }
  desenharTempo();
}

aoAbrir.push(atualizarTempo);
