/* Toponimia · app.js
   Tres lugares al día, los mismos para todos: se empareja cada uno con su significado entre seis
   (los tres buenos y un señuelo de cada lugar). Sin servidor: el día sale de la fecha local
   (FECHA_INICIO, en config.js) y la partida se guarda en localStorage. */
'use strict';

const CLAVE = 'toponimia:v1';
const RONDAS = 3;
const MS_DIA = 86400000;

const ESTADISTICAS_INICIALES = { jugadas: 0, aciertos: 0, racha: 0, rachaMax: 0, ultimoDia: 0 };

/** Color de la etiqueta de cada lengua. Las compuestas («italiano / español») usan la primera. */
const LENGUAS = {
  'latín': '#7A5C3E',
  'griego': '#4F6A7A',
  'árabe': '#3F6B5C',
  'fenicio': '#6B4E71',
  'púnico': '#6B4E71',
  'hebreo': '#5E5A82',
  'náhuatl': '#9A6A2F',
  'purépecha': '#8A5A44',
  'maya': '#5F7A45',
  'quechua': '#8C4F3A',
  'guaraní': '#4E7A63',
  'taíno': '#3D7378',
  'mapudungun': '#6E6448',
  'yagán': '#4A6A80',
  'guanche': '#8A6A3A',
  'bubi': '#5A7058',
  'aimara': '#7A4A5E',
  'caddo': '#5B6E3A',
  'español': '#A0453A',
  'italiano': '#47658C',
  'portugués': '#6C7F3A',
  'francés': '#5A5F8C',
  'inglés': '#5C6670',
  'vasco': '#7E3F4D',
  'catalán': '#8C5A2E',
  'celta': '#56704F',
  'germánico': '#6A6A5A',
  'iroqués': '#6E5A3E',
  'ojibwe': '#3F6470',
  'aleutiano': '#5A6B86',
  'neerlandés': '#B06A2E',
};
const LENGUA_POR_DEFECTO = '#8A7B6B';

/** Regiones tan amplias que el mini-mapa se ve mejor más alejado. */
const REGIONES_AMPLIAS = ['Sudamérica', 'Centroamérica', 'Estados Unidos', 'Estados Unidos / México'];

const CHINCHETA =
  '<svg viewBox="0 0 24 34" width="24" height="34" aria-hidden="true">' +
  '<path d="M12 33C10 26 2 20.5 2 12a10 10 0 0 1 20 0c0 8.5-8 14-10 21z" fill="#B23A2E" stroke="#7E2A21" stroke-width="1.2"/>' +
  '<circle cx="12" cy="12" r="3.6" fill="#FBF6EC"/></svg>';

const app = document.getElementById('app');
const anuncio = document.getElementById('anuncio');
const aviso = document.getElementById('aviso');
const panel = document.getElementById('estadisticas');
const reglas = document.getElementById('reglas');

let DIAS = [];
let mapa = null;

const parametros = new URLSearchParams(location.search);
/** Modo prueba: ?dia=3 fuerza el día 3 sin tocar la partida ni las estadísticas guardadas. */
const diaPrueba = /^\d+$/.test(parametros.get('dia') || '') ? Math.max(1, Number(parametros.get('dia'))) : 0;
/** En modo prueba las respuestas solo viven en memoria (se pierden al recargar). */
let respuestasPrueba = [];

let guardado = cargar();
let diaMostrado = 0;
/** 'tablero' mientras queda algún lugar por emparejar; 'resultado' al final. */
let vista = 'tablero';
/** Lugar cuya ficha se ve bajo el tablero (índice de la ronda) o null. */
let fichaAbierta = null;
/** Lo tocado y aún sin emparejar: un lugar (índice) y un significado (texto). */
let seleccion = { lugar: null, significado: null };
/** La ficha y la pareja solo se animan justo al emparejar, no al volver a pintarlas. */
let animarFicha = false;

/* ---------- Almacenamiento ---------- */

function cargar() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) return JSON.parse(crudo);
  } catch (e) {
    // Sin almacenamiento (modo privado, etc.): se juega igual, sin memoria.
  }
  return { estadisticas: { ...ESTADISTICAS_INICIALES }, resultados: {}, partida: null };
}

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(guardado));
  } catch (e) {
    // Ídem.
  }
}

/* ---------- Fechas (hora local) ---------- */

/** Número del día de hoy (nº 1 el día de FECHA_INICIO). Puede ser 0 o negativo antes de empezar. */
function numeroDeHoy() {
  const [a, m, d] = FECHA_INICIO.split('-').map(Number);
  const ahora = new Date();
  // Date.UTC con las fechas locales: así el cambio de hora no descuadra la cuenta.
  const hoy = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return Math.round((hoy - Date.UTC(a, m - 1, d)) / MS_DIA) + 1;
}

function cuentaAtras() {
  const ahora = new Date();
  const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
  const s = Math.max(0, Math.floor((manana - ahora) / 1000));
  const dos = (n) => String(n).padStart(2, '0');
  return `${dos(Math.floor(s / 3600))}:${dos(Math.floor(s / 60) % 60)}:${dos(s % 60)}`;
}

function fechaLarga(numero) {
  const [a, m, d] = FECHA_INICIO.split('-').map(Number);
  return new Date(a, m - 1, d + numero - 1).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}

/* ---------- Rondas ---------- */

/** Rondas del día `numero`: al acabarse los días, el ciclo vuelve a empezar por el primero. */
function rondasDe(numero) {
  if (numero < 1 || !DIAS.length) return null;
  const enCiclo = ((numero - 1) % DIAS.length) + 1;
  const dia = DIAS.find((d) => d.dia === enCiclo);
  return dia ? dia.rondas : null;
}

const esInversa = (r) => r.tipo === 'inversa';

/** El significado: en las inversas va entre comillas en la pregunta. */
function significado(r) {
  if (!esInversa(r)) return r.correcta;
  const m = /«([^»]+)»/.exec(r.pregunta || '');
  return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : '';
}

/** Generador pseudoaleatorio determinista (mulberry32): todos ven las opciones en el mismo orden. */
function aleatorio(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function barajar(lista, rnd) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** El nombre que se empareja: el lugar o, en las rondas inversas, el topónimo correcto. */
const nombreDe = (r) => (esInversa(r) ? r.correcta : r.lugar);

/**
 * Los significados del tablero, barajados igual para todos: el de cada lugar y un señuelo de cada
 * uno, elegido entre sus opciones falsas. Las rondas inversas no tienen significados falsos (sus
 * opciones son lugares): esos días salen cinco.
 */
function significadosDe(numero, rondas) {
  const lista = [];
  rondas.forEach((r, i) => {
    lista.push(significado(r));
    if (esInversa(r)) return;
    const senuelos = r.opciones.filter((o) => o !== r.correcta);
    if (senuelos.length) lista.push(senuelos[Math.floor(aleatorio(numero * 7919 + i * 104729)() * senuelos.length)]);
  });
  return barajar([...new Set(lista)], aleatorio(numero * 7919));
}

/** Respuestas del día, una por lugar y en su posición (null si aún no se ha emparejado). */
function respuestasDe(numero) {
  const lista = diaPrueba ? respuestasPrueba
    : guardado.partida && guardado.partida.dia === numero ? guardado.partida.respuestas : [];
  return Array.from({ length: RONDAS }, (_, i) => lista[i] ?? null);
}

const contestadas = (respuestas) => respuestas.filter((r) => r !== null).length;

/** Antes se elegía el topónimo en las rondas inversas: una partida guardada así también vale. */
const acierto = (r, respuesta) => respuesta === significado(r) || (esInversa(r) && respuesta === r.correcta);

/** true, false o null (sin emparejar) por lugar. */
function aciertosDe(rondas, respuestas) {
  return respuestas.map((resp, i) => (resp === null ? null : acierto(rondas[i], resp)));
}

/* ---------- Estadísticas ---------- */

/** La racha cuenta los días seguidos en que se termina la partida, se acierte o no. */
function registrarDia(e, dia, aciertos) {
  if (e.ultimoDia === dia) return e;
  const racha = e.ultimoDia === dia - 1 ? e.racha + 1 : 1;
  return {
    jugadas: e.jugadas + 1,
    aciertos: e.aciertos + aciertos.filter(Boolean).length,
    racha,
    rachaMax: Math.max(e.rachaMax, racha),
    ultimoDia: dia,
  };
}

/** Si se salta un día, la racha se pierde. */
function rachaVigente(e, hoy) {
  return e.ultimoDia >= hoy - 1 ? e.racha : 0;
}

/* ---------- Interfaz ---------- */

function esc(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Escapa y convierte *cursiva* en <em>. */
function enriquecer(texto) {
  return esc(texto).replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function numeroActual() {
  return diaPrueba || numeroDeHoy();
}

function quitarMapa() {
  if (mapa) {
    mapa.remove();
    mapa = null;
  }
}

/** Con los tres lugares de hoy jugados, la mano ☜ marca Toponimia como «Hecho» en Almanaque,
    y su hoja muestra los aciertos del día y la racha. */
function avisarAlmanaque(numero, rondas, respuestas) {
  const aciertos = aciertosDe(rondas, respuestas);
  const avisar = () => window.almanaqueHecho?.({
    aciertos: aciertos.filter(Boolean).length,
    total: aciertos.length,
    racha: rachaVigente(guardado.estadisticas, numero),
  });
  // app.js va antes que volver-almanaque.js (los dos con defer): si aún no existe,
  // se espera a DOMContentLoaded, que llega después de todos los scripts con defer.
  if (window.almanaqueHecho) avisar();
  else document.addEventListener('DOMContentLoaded', avisar, { once: true });
}

function render() {
  quitarMapa();
  const numero = numeroActual();
  const rondas = rondasDe(numero);

  if (numero < 1) return pintarFuera(antesDeEmpezar());

  const respuestas = respuestasDe(numero);
  const completa = contestadas(respuestas) === RONDAS;
  if (numero !== diaMostrado) {
    diaMostrado = numero;
    vista = completa ? 'resultado' : 'tablero';
    fichaAbierta = null;
    seleccion = { lugar: null, significado: null };
  }
  if (completa && !diaPrueba) avisarAlmanaque(numero, rondas, respuestas);

  app.innerHTML = `
    ${diaPrueba ? avisoPrueba(numero) : ''}
    ${vista === 'tablero' ? tablero(numero, rondas, respuestas) : resultado(numero, rondas, respuestas)}
  `;

  if (vista === 'tablero') {
    prepararTablero(numero, rondas);
    ajustarNombres();
  }
  animarFicha = false;

  const seguir = app.querySelector('#seguir');
  if (seguir) {
    seguir.addEventListener('click', () => {
      fichaAbierta = null;
      if (completa) vista = 'resultado';
      render();
      scrollTo({ top: 0, behavior: 'smooth' });
      // Con teclado, el foco vuelve al primer lugar por emparejar.
      app.querySelector('.lugar:not(:disabled)')?.focus({ preventScroll: true });
    });
  }
  const compartirBoton = app.querySelector('#compartir');
  if (compartirBoton) compartirBoton.addEventListener('click', () => compartir(numero, aciertosDe(rondas, respuestas)));

  const contenedor = app.querySelector('.mapa');
  if (contenedor) montarMapa(contenedor, rondas[fichaAbierta]);
}

function pintarFuera(html) {
  diaMostrado = 0;
  app.innerHTML = html;
}

function antesDeEmpezar() {
  return `
    <section class="mensaje">
      <img src="icons/toponimia-logo.svg" width="96" height="96" alt="">
      <h2>Todavía no</h2>
      <p>Toponimia empieza el ${esc(fechaLarga(1))}. ¡Vuelve entonces!</p>
    </section>`;
}

function avisoPrueba(numero) {
  const enlace = (n, texto, etiqueta) =>
    `<a href="?dia=${n}" aria-label="${etiqueta}" ${n < 1 ? 'aria-disabled="true" tabindex="-1"' : ''}>${texto}</a>`;
  return `
    <p class="prueba">
      ${enlace(numero - 1, '‹', 'Día anterior')}
      <span>Modo prueba · día ${numero}${numero <= DIAS.length ? ` de ${DIAS.length}` : ''}</span>
      ${enlace(numero + 1, '›', 'Día siguiente')}
    </p>`;
}

function tablero(numero, rondas, respuestas) {
  const aciertos = aciertosDe(rondas, respuestas);
  // De cada significado ya emparejado, el lugar al que pertenece y si se acertó.
  const asignados = new Map();
  rondas.forEach((r, i) => { if (aciertos[i] !== null) asignados.set(significado(r), { i, bien: aciertos[i] }); });
  const recien = animarFicha ? fichaAbierta : null;

  const lugares = rondas.map((r, i) => {
    const hecho = aciertos[i] !== null;
    const estado = hecho ? (aciertos[i] ? 'bien' : 'mal') : '';
    const etiqueta = hecho
      ? `${nombreDe(r)}: ${aciertos[i] ? 'acertado' : 'fallado'}, ${significado(r)}`
      : `${nombreDe(r)}, ${r.region}`;
    return `<button class="lugar ${estado} ${i === recien ? 'recien' : ''}" type="button" data-indice="${i}"
        aria-pressed="false" aria-label="${esc(etiqueta)}" ${hecho ? 'disabled' : ''}>
        <span class="lugar-nombre" lang="es">${esc(nombreDe(r))}</span>
        <span class="lugar-region">${esc(r.region)}</span>
        ${hecho ? `<span class="lugar-significado">${esc(significado(r))}</span><span class="senal" aria-hidden="true">${aciertos[i] ? '✓' : '✗'}</span>` : ''}
      </button>`;
  }).join('');

  const significados = significadosDe(numero, rondas).map((texto) => {
    const a = asignados.get(texto);
    const fallo = recien !== null && aciertos[recien] === false && texto === respuestas[recien];
    const clases = a ? `asignado ${a.bien ? 'bien' : 'mal'} ${a.i === recien ? 'recien' : ''}` : fallo ? 'fallo' : '';
    const dueno = a ? `<span class="dueno" aria-hidden="true">${esc(nombreDe(rondas[a.i]))}</span>` : '';
    const etiqueta = a ? ` aria-label="${esc(`${texto}: ${nombreDe(rondas[a.i])}`)}"` : '';
    return `<button class="opcion significado-opcion ${clases}" type="button" data-valor="${esc(texto)}"
        aria-pressed="false"${etiqueta} ${a ? 'disabled' : ''}><span>${esc(texto)}</span>${dueno}</button>`;
  }).join('');

  return `
    <section class="reto tablero">
      <p class="ronda-numero">Nº ${numero} · ${contestadas(respuestas)} de ${RONDAS}</p>
      <div class="lugares" role="group" aria-label="Lugares">${lugares}</div>
      <p class="pista" id="pista">${pistaTablero(rondas)}</p>
      <div class="opciones" role="group" aria-label="Significados">${significados}</div>
    </section>
    ${fichaAbierta !== null ? ficha(rondas[fichaAbierta], aciertos[fichaAbierta], respuestas[fichaAbierta], contestadas(respuestas) === RONDAS) : ''}
  `;
}

/** La línea entre lugares y significados dice qué falta por tocar. */
function pistaTablero(rondas) {
  if (seleccion.lugar !== null && rondas) return `¿Qué significa <strong>${esc(nombreDe(rondas[seleccion.lugar]))}</strong>?`;
  if (seleccion.significado !== null) return `¿Qué lugar significa <strong>«${esc(seleccion.significado)}»</strong>?`;
  return 'Toca un lugar y después su significado, o al revés.';
}

/** Tocar marca o desmarca sin volver a pintar; con lugar y significado elegidos, se empareja. */
function prepararTablero(numero, rondas) {
  const pintarSeleccion = () => {
    app.querySelectorAll('.lugar').forEach((b) => {
      const activo = Number(b.dataset.indice) === seleccion.lugar;
      b.classList.toggle('elegido', activo);
      b.setAttribute('aria-pressed', String(activo));
    });
    app.querySelectorAll('.significado-opcion').forEach((b) => {
      const activo = b.dataset.valor === seleccion.significado;
      b.classList.toggle('elegido', activo);
      b.setAttribute('aria-pressed', String(activo));
    });
    app.querySelector('#pista').innerHTML = pistaTablero(rondas);
  };
  const intentar = () => {
    if (seleccion.lugar === null || seleccion.significado === null) {
      pintarSeleccion();
      if (seleccion.lugar !== null) anunciar(`${nombreDe(rondas[seleccion.lugar])}: elige su significado.`);
      else if (seleccion.significado !== null) anunciar(`«${seleccion.significado}»: elige el lugar.`);
      return;
    }
    const { lugar, significado: valor } = seleccion;
    seleccion = { lugar: null, significado: null };
    responder(numero, lugar, valor);
  };
  app.querySelectorAll('.lugar').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.indice);
    seleccion.lugar = seleccion.lugar === i ? null : i;
    intentar();
  }));
  app.querySelectorAll('.significado-opcion').forEach((b) => b.addEventListener('click', () => {
    seleccion.significado = seleccion.significado === b.dataset.valor ? null : b.dataset.valor;
    intentar();
  }));
  // Lo tocado antes de volver a pintar (por ejemplo, al cerrar una ficha) sigue marcado.
  if (seleccion.lugar !== null || seleccion.significado !== null) pintarSeleccion();
}

/**
 * Si una palabra no cabe en su tarjeta (Chapultepec), se achica la letra hasta 15 px; si ni así
 * cabe (Chichicastenango en un móvil estrecho), se parte con guion.
 */
function ajustarNombres() {
  app.querySelectorAll('.lugar-nombre').forEach((n) => {
    n.style.fontSize = '';
    n.classList.remove('partir');
    let tamano = parseFloat(getComputedStyle(n).fontSize);
    while (n.scrollWidth > n.clientWidth + 1 && tamano > 15) {
      tamano -= 0.5;
      n.style.fontSize = `${tamano}px`;
    }
    if (n.scrollWidth > n.clientWidth + 1) n.classList.add('partir');
  });
}
addEventListener('resize', () => { if (vista === 'tablero') ajustarNombres(); });

function anunciar(texto) {
  anuncio.textContent = '';
  // En otro fotograma, para que el lector de pantalla lo lea aunque se repita el texto.
  requestAnimationFrame(() => { anuncio.textContent = texto; });
}

function etiquetaLengua(lengua) {
  const principal = lengua.split('/')[0].trim().toLowerCase();
  const color = LENGUAS[principal] || LENGUA_POR_DEFECTO;
  return `<span class="lengua" style="--color-lengua:${color}">${esc(lengua)}</span>`;
}

function ficha(r, acertada, respuesta, ultima) {
  const titulo = nombreDe(r);
  const donde = r.lugar !== titulo ? `${r.lugar} · ${r.region}` : r.region;
  return `
    <section class="ficha ${animarFicha ? 'entra' : ''}" tabindex="-1" aria-label="Ficha de ${esc(titulo)}">
      <p class="veredicto ${acertada ? 'bien' : 'mal'}">
        ${acertada ? '<span aria-hidden="true">✓</span> ¡Correcto!' : `<span aria-hidden="true">✗</span> No era «${esc(respuesta)}»`}
      </p>
      <h3 class="ficha-lugar">${esc(titulo)}</h3>
      <p class="ficha-region">${esc(donde)}</p>
      <p class="origen"><em class="original">${esc(r.original)}</em> ${etiquetaLengua(r.lengua)}</p>
      <p class="significado"><span class="rotulo">Significa</span> ${esc(significado(r))}</p>
      <p class="nota">${enriquecer(r.nota)}</p>
      ${window.L ? `<div class="mapa" role="img" aria-label="Mapa: ${esc(r.lugar)}, ${esc(r.region)}"></div>` : ''}
    </section>
    <button id="seguir" class="boton" type="button">${ultima ? 'Ver resultado' : 'Seguir'}</button>
  `;
}

/* ---------- Mini-mapa ---------- */

function montarMapa(contenedor, r) {
  const zoom = r.zoom || (REGIONES_AMPLIAS.includes(r.region) ? 3 : 5);
  mapa = L.map(contenedor, {
    center: [r.lat, r.lon],
    zoom,
    zoomControl: false,
    dragging: false,
    touchZoom: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    tap: false,
    attributionControl: true,
  });
  mapa.attributionControl.setPrefix(false);

  let cargadas = 0;
  // Esri Light Gray Canvas: claro, discreto y sin clave (CARTO ya pide clave de API).
  // Con el modo oscuro elegido en Almanaque, su pareja Dark Gray.
  const base = document.documentElement.dataset.theme === 'dark' ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base';
  const capa = L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${base}/MapServer/tile/{z}/{y}/{x}`, {
    maxZoom: 16,
    crossOrigin: true,
    attribution: 'Teselas © <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> — Esri, HERE, Garmin, © OpenStreetMap',
  });
  capa.on('tileload', () => {
    cargadas++;
    contenedor.classList.add('cargado');
  });
  // Sin teselas (sin conexión): el mapa se retira y la ficha queda limpia.
  const retirar = () => {
    if (cargadas === 0 && contenedor.isConnected) {
      quitarMapa();
      contenedor.remove();
    }
  };
  capa.on('load', retirar);
  setTimeout(retirar, 8000);
  capa.addTo(mapa);

  L.marker([r.lat, r.lon], {
    icon: L.divIcon({ className: 'chincheta', html: CHINCHETA, iconSize: [24, 34], iconAnchor: [12, 33] }),
    keyboard: false,
    interactive: false,
  }).addTo(mapa);
}

/* ---------- Resultado ---------- */

// Punta de la rosa de los vientos del logo: marca de la ficha final.
const ESTRELLA = 'M12 1.5 14.6 9.4 22.5 12 14.6 14.6 12 22.5 9.4 14.6 1.5 12 9.4 9.4Z';

function resultado(numero, rondas, respuestas) {
  const aciertos = aciertosDe(rondas, respuestas);
  const total = aciertos.filter(Boolean).length;
  const e = guardado.estadisticas;
  const frases = ['Hoy el mapa se resistió.', 'Un buen comienzo de viaje.', '¡Casi perfecto!', '¡Pleno de topónimos!'];
  const lista = rondas
    .map(
      (r, i) => `
        <li>
          <span class="marca ${aciertos[i] ? 'bien' : 'mal'}" aria-label="${aciertos[i] ? 'Acierto' : 'Fallo'}">${aciertos[i] ? '✓' : '✗'}</span>
          <span class="lista-lugar">${esc(nombreDe(r))}</span>
          <span class="lista-significado">${esc(significado(r))}</span>
        </li>`,
    )
    .join('');
  // Una estrella de la rosa de los vientos por ronda: llena si se acertó, hueca si no.
  const estrellas = aciertos
    .map((a) => `<svg class="${a ? 'bien' : 'mal'}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ESTRELLA}"/></svg>`)
    .join('');
  const porcentaje = e.jugadas ? Math.round((e.aciertos / (e.jugadas * RONDAS)) * 100) : 0;

  return `
    <section class="resultado" aria-label="Resultado de hoy">
      <div class="ficha-final">
        <p class="marcas" role="img" aria-label="${total} ${total === 1 ? 'acierto' : 'aciertos'} de ${RONDAS}">${estrellas}</p>
        <h2>${total} <small>de ${RONDAS}</small></h2>
        <p class="frase">${frases[total]}</p>
      </div>
      <ol class="lista-resultado">${lista}</ol>
    </section>

    ${diaPrueba ? '' : `<section class="estadisticas" aria-label="Estadísticas">
      <div><strong>${e.jugadas}</strong><span>días</span></div>
      <div><strong>${porcentaje}%</strong><span>aciertos</span></div>
      <div><strong>${rachaVigente(e, numero)}</strong><span>racha</span></div>
      <div><strong>${e.rachaMax}</strong><span>mejor racha</span></div>
    </section>`}

    <button id="compartir" class="boton" type="button">Compartir</button>
    <a class="boton boton-secundario" data-almanaque-volver hidden href="https://emiliocasanovabiscarri.github.io/Almanaque/">☜ Regresar al Almanaque</a>
    ${diaPrueba ? '' : `<p class="siguiente">Nuevos lugares en <time id="cuenta">${cuentaAtras()}</time></p>`}
  `;
}

/* ---------- Panel de estadísticas ---------- */

function pintarEstadisticas() {
  const e = guardado.estadisticas;
  const hoy = numeroDeHoy();
  const porcentaje = e.jugadas ? Math.round((e.aciertos / (e.jugadas * RONDAS)) * 100) : 0;
  const dias = Object.keys(guardado.resultados || {}).map(Number).sort((a, b) => b - a);
  const historial = dias.length
    ? `<h3>Tus días</h3>
       <ol class="historial">${dias
         .map((d) => `<li><span>nº ${d}</span><span class="mini-cuadros" aria-label="${guardado.resultados[d].filter(Boolean).length} de ${RONDAS}">${guardado.resultados[d].map((a) => `<span class="${a ? 'bien' : 'mal'}"></span>`).join('')}</span></li>`)
         .join('')}</ol>`
    : '<p class="vacio">Aún no has terminado ninguna partida.</p>';

  document.getElementById('estadisticas-cuerpo').innerHTML = `
    <div class="cifras">
      <div><strong>${e.jugadas}</strong><span>jugadas</span></div>
      <div><strong>${e.aciertos}</strong><span>aciertos</span></div>
      <div><strong>${porcentaje}%</strong><span>acierto</span></div>
      <div><strong>${rachaVigente(e, hoy)}</strong><span>racha</span></div>
      <div><strong>${e.rachaMax}</strong><span>mejor racha</span></div>
    </div>
    ${historial}
    ${diaPrueba ? '<p class="vacio">En modo prueba las partidas no cuentan.</p>' : ''}
  `;
}

panel.querySelector('.cerrar').addEventListener('click', () => panel.close());
panel.addEventListener('click', (ev) => {
  if (ev.target === panel) panel.close();
});
document.getElementById('abrir-estadisticas').addEventListener('click', () => {
  pintarEstadisticas();
  panel.showModal();
});

/* ---------- Reglas ---------- */

reglas.querySelectorAll('.cerrar, .empezar').forEach((b) => b.addEventListener('click', () => reglas.close()));
reglas.addEventListener('click', (ev) => {
  if (ev.target === reglas) reglas.close();
});
document.getElementById('abrir-reglas').addEventListener('click', () => {
  reglas.scrollTop = 0;
  reglas.showModal();
});

/** La primera vez que se abre el juego, las reglas salen solas. */
function reglasPrimeraVez() {
  if (guardado.reglasVistas) return;
  reglas.showModal();
  guardado = { ...guardado, reglasVistas: true };
  guardar();
}

/* ---------- Acciones ---------- */

function responder(numero, indice, valor) {
  const respuestas = respuestasDe(numero);
  if (respuestas[indice] !== null) return;
  const nuevas = respuestas.map((r, i) => (i === indice ? valor : r));
  if (diaPrueba) {
    respuestasPrueba = nuevas;
  } else {
    let { estadisticas, resultados = {} } = guardado;
    if (contestadas(nuevas) === RONDAS) {
      const aciertos = aciertosDe(rondasDe(numero), nuevas);
      estadisticas = registrarDia(estadisticas, numero, aciertos);
      resultados = { ...resultados, [numero]: aciertos };
    }
    guardado = { ...guardado, estadisticas, resultados, partida: { dia: numero, respuestas: nuevas } };
    guardar();
  }
  const r = rondasDe(numero)[indice];
  anunciar(acierto(r, valor)
    ? `${nombreDe(r)}, «${valor}»: ¡correcto!`
    : `${nombreDe(r)}: no era «${valor}», era «${significado(r)}».`);
  fichaAbierta = indice;
  animarFicha = true;
  render();
  const revelada = app.querySelector('.ficha');
  if (revelada) {
    revelada.focus({ preventScroll: true });
    setTimeout(() => revelada.scrollIntoView({ behavior: 'smooth', block: 'start' }), 450);
  }
}

// Una marca por lugar: ▰ acertado, ▱ fallado. «Toponimia nº 7 ▰▱▰ 2/3 aciertos» y el enlace.
function textoCompartir(numero, aciertos) {
  const marcas = aciertos.map((a) => (a ? '▰' : '▱')).join('');
  return `Toponimia nº ${numero} ${marcas} ${aciertos.filter(Boolean).length}/${aciertos.length} aciertos\nemiliocasanovabiscarri.github.io/Toponimia`;
}

async function compartir(numero, aciertos) {
  const texto = textoCompartir(numero, aciertos);
  try {
    if (navigator.share) {
      await navigator.share({ text: texto });
      return;
    }
    await navigator.clipboard.writeText(texto);
    mostrarAviso('Resultado copiado');
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    mostrarAviso('No se pudo compartir');
  }
}

function mostrarAviso(texto) {
  aviso.textContent = texto;
  aviso.classList.add('visible');
  setTimeout(() => aviso.classList.remove('visible'), 2000);
}

/* ---------- Arranque ---------- */

/**
 * La portada con el logo se ve al menos 1,5 s desde que se abre la página (y 1,4 s desde que se
 * pinta, por si tarda la primera visita) y luego se desvanece. `despues` corre poco después de
 * empezar el fundido.
 */
function retirarPortada(despues) {
  const portada = document.getElementById('portada');
  if (!portada) return despues?.();
  const pintada = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? performance.now();
  setTimeout(() => {
    portada.classList.add('oculta');
    setTimeout(() => portada.remove(), 500);
    if (despues) setTimeout(despues, 350);
  }, Math.max(0, 1500 - performance.now(), 1400 - (performance.now() - pintada)));
}

async function iniciar() {
  try {
    DIAS = await fetch('data/dias.json').then((r) => r.json());
  } catch (err) {
    app.innerHTML = '<p class="error">No se han podido cargar los lugares. Prueba a recargar la página.</p>';
    retirarPortada();
    return;
  }

  render();
  // Con la tipografía ya cargada, los nombres largos se miden de nuevo.
  document.fonts?.ready.then(() => { if (vista === 'tablero') ajustarNombres(); });
  retirarPortada(reglasPrimeraVez);

  // Cada segundo: la cuenta atrás y, a medianoche, el día nuevo.
  let ultimoNumero = numeroDeHoy();
  setInterval(() => {
    const hoy = numeroDeHoy();
    if (!diaPrueba && hoy !== ultimoNumero) {
      ultimoNumero = hoy;
      return render();
    }
    const cuenta = document.getElementById('cuenta');
    if (cuenta) cuenta.textContent = cuentaAtras();
  }, 1000);
}

iniciar();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js');
}
