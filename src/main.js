// Interfaz: portada, secciones, ficha con navegación fija, práctica de uso, evaluación y vista por capas.
// Fuentes alojadas en el propio sitio (no dependen de Google Fonts)
import '@fontsource/rubik/latin-400.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './style.css';
import PARTES from './data/partes.json';
import PASOS from './data/recorrido.json';
import USO from './data/uso.json';
import QUIZ from './data/quiz.json';
import { CONFIG } from './config.js';
import { Viewer } from './viewer.js';
import { Quiz } from './quiz.js';
import { Monitor } from './monitor.js';

// Fotos de referencia tomadas del video tutorial del CPMA (Universidad Autónoma de Occidente)
const FOTOS = Object.fromEntries(Object.entries(import.meta.glob('./assets/tutorial/*.jpg', { eager: true, import: 'default' }))
  .map(([k, v]) => [k.split('/').pop().replace('.jpg', ''), v]));

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Datos ----------
PASOS.forEach((s, i) => (s.n = i + 1));
const pasoById = Object.fromEntries(PASOS.map((s) => [s.id, s]));
const pasoDeParte = {};
PASOS.forEach((s) => s.partes.forEach((p) => (pasoDeParte[p] = s.id)));
PARTES.forEach((p) => { const s = pasoById[pasoDeParte[p.id]]; p.n = s?.n ?? '·'; p.titulo = s?.titulo ?? p.id; });
const CONTROLES = [...new Set(USO.flatMap((u) => [u.control, ...u.acciones.map((a) => a.objeto)]))];

const STORE = 'z90-progreso';
const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } })();
const state = {
  mode: 'recorrido', paso: 0, uso: 0, usoHecho: false, usoFin: false,
  visto: new Set(saved.visto || []), usoListo: new Set(saved.uso || []),
};
const save = () => { try { localStorage.setItem(STORE, JSON.stringify({ visto: [...state.visto], uso: [...state.usoListo] })); } catch { /* sin almacenamiento */ } };

const body = $('#ficha');
const fPrev = $('#f-prev'), fNext = $('#f-next');
const viewer = new Viewer($('#stage'), PARTES, CONTROLES);
const monitor = new Monitor($('#monitor'));
const quiz = new Quiz(body, QUIZ, pasoById, {
  onShow: (id) => {
    if (!id) { viewer.select(null); return; }
    const s = pasoById[id];
    viewer.select(s.partes);
    viewer.focusParts(s.partes, viewer.t, s.vista);
  },
  onReview: (id) => { state.paso = PASOS.indexOf(pasoById[id]); setMode('recorrido'); },
  onChange: () => { updateFoot(); updateBar(); },
});

// ---------- Portada ----------
$('#btn-start').addEventListener('click', () => {
  $('#inicio').hidden = true;
  $('#app').hidden = false;
  setMode(state.mode);
  body.focus({ preventScroll: true });
});
$('#btn-home').addEventListener('click', () => {
  $('#app').hidden = true;
  $('#inicio').hidden = false;
  $('#btn-start').focus();
});

// Foto del tutorial con su minuto, o nada si el paso no tiene foto
function foto(id, pie, min) {
  if (!id || !FOTOS[id]) return '';
  return `<figure class="ref">
    <img src="${FOTOS[id]}" alt="${esc(pie || 'Referencia en la cámara real')}" width="480" height="270" loading="lazy">
    <figcaption><span>${esc(pie || 'En la cámara real')}</span>${min ? `<b>Tutorial CPMA · ${min}</b>` : ''}</figcaption>
  </figure>`;
}

// ---------- Recorrido ----------
function renderPaso(s) {
  body.innerHTML = `
    <p class="eyebrow">Recorrido · Parte ${s.n} de ${PASOS.length}</p>
    <h2 tabindex="-1"><span class="num">${s.n}</span>${esc(s.titulo)}</h2>
    <div class="qa"><h3>¿Qué es?</h3><p>${esc(s.que_es)}</p></div>
    <div class="qa"><h3>¿Para qué sirve?</h3><p>${esc(s.para_que)}</p></div>
    <div class="tip"><span class="tip-tag">Tip</span><p>${esc(s.tip)}</p></div>
    ${foto(s.foto, s.foto_pie, s.min)}`;
}

function goPaso(i) {
  i = Math.max(0, Math.min(PASOS.length - 1, i));
  state.paso = i;
  const s = PASOS[i];
  // Solo las partes internas obligan a ver por capas; en las demás se respeta la vista que eligió el estudiante
  const t = s.despiece ?? (viewer.t > 0.5 ? 1 : 0);
  viewer.select(s.partes);
  viewer.animateExplode(t);
  viewer.focusParts(s.partes, t, s.vista);
  state.visto.add(s.id);
  save();
  renderPaso(s);
  updateFoot();
  updateBar();
  updateTools();
}

// ---------- Uso de la cámara ----------
function pantallaHasta(k) {
  const s = {};
  for (let i = 0; i < k; i++) Object.assign(s, USO[i].pantalla);
  return s;
}

async function goUso(k) {
  k = Math.max(0, Math.min(USO.length - 1, k));
  state.uso = k;
  state.usoHecho = false;
  state.usoFin = false;
  viewer.resetControls();
  USO.forEach((u) => viewer.setInitial(u.acciones));
  for (let i = 0; i < k; i++) await viewer.runActions(USO[i].acciones, true);
  monitor.set(pantallaHasta(k));
  const u = USO[k];
  viewer.setPulse(u.control, u.parte);
  viewer.focusControl(u.control, u.vista, u.parte);
  renderUso();
  updateFoot();
  updateBar();
}

function renderUso(pista = '') {
  const u = USO[state.uso];
  const head = `
    <p class="eyebrow">Uso de la cámara · Paso ${state.uso + 1} de ${USO.length}</p>
    <h2 tabindex="-1"><span class="num">${state.uso + 1}</span>${esc(u.titulo)}</h2>`;
  const ref = foto(u.foto, 'Así se ve en la cámara real', u.min);
  if (state.usoHecho) {
    body.innerHTML = `${head}
      <div class="status ok"><span class="status-mark" aria-hidden="true">✓</span><p>${esc(u.hecho)}</p></div>
      <button type="button" class="btn secondary" data-uso="repetir">Repetir este paso</button>
      ${ref}`;
  } else {
    body.innerHTML = `${head}
      <p class="instr">${esc(u.instruccion)}</p>
      <div class="status ${pista ? 'warn' : 'info'}" role="status">
        <span class="status-mark" aria-hidden="true">${pista ? '!' : ''}</span>
        <p>${pista ? esc(pista) : 'La pieza que parpadea en el modelo es la que debes tocar.'}</p>
      </div>
      <button type="button" class="btn secondary" data-uso="mostrar">Muéstrame cómo</button>
      ${ref}`;
  }
}

function renderUsoFinal() {
  state.usoFin = true;
  viewer.setPulse(null);
  body.innerHTML = `
    <p class="eyebrow">Uso de la cámara · Completado</p>
    <h2 tabindex="-1">¡Grabaste tu primera toma!</h2>
    <p class="resumen">Ya sabes preparar la Z90V, ajustar la exposición, la luz y el color, encuadrar, enfocar, configurar el sonido y grabar.</p>
    <div class="green-box sm"><p>Batería → pantalla → tarjeta → formato AVCHD → MANUAL → IRIS → ND → balance de blancos → zoom → enfoque → sonido → REC</p></div>
    <p class="resumen">Para repasar con la cámara en la mano, mira el video tutorial del CPMA sobre la Z90.</p>
    <button type="button" class="btn secondary" data-uso="reiniciar">Repetir la práctica</button>`;
  updateFoot();
  updateBar();
}

async function completarUso() {
  if (state.usoHecho) return;
  const u = USO[state.uso];
  state.usoHecho = true;
  viewer.setPulse(null);
  renderUso();
  updateFoot();
  await viewer.runActions(u.acciones);
  monitor.set({ ...pantallaHasta(state.uso), ...u.pantalla });
  state.usoListo.add(u.id);
  save();
  updateBar();
  fNext.focus({ preventScroll: true });
}

const nombreDe = (part) => pasoById[pasoDeParte[part]]?.titulo || 'otra parte';

// ---------- Clics en el modelo ----------
viewer.on('pick', ({ part, control }) => {
  if (state.mode === 'evaluar') return quiz.pick(pasoDeParte[part]);
  if (state.mode === 'uso') {
    if (state.usoHecho || state.usoFin || !part) return;
    const u = USO[state.uso];
    const ok = control === u.control || (!viewer.hasControl(u.control) && part === u.parte);
    if (ok) completarUso();
    else renderUso(`Eso es parte de «${nombreDe(part)}». ${u.pista}`);
    return;
  }
  if (part) goPaso(PASOS.indexOf(pasoById[pasoDeParte[part]]));
});

viewer.on('hover', (id) => {
  $('#hover-name').textContent = id && state.mode === 'recorrido' ? nombreDe(id) : '';
});

body.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !b.dataset.uso) return;
  if (b.dataset.uso === 'mostrar') completarUso();
  else if (b.dataset.uso === 'repetir') goUso(state.uso);
  else if (b.dataset.uso === 'reiniciar') { state.usoListo.clear(); save(); goUso(0); }
});

// ---------- Pie de la ficha: siempre los mismos dos botones, del mismo tamaño ----------
function setNext(label, { enabled = true, strong = true } = {}) {
  fNext.textContent = label;
  fNext.disabled = !enabled;
  fNext.classList.toggle('primary', strong);
  fNext.classList.toggle('secondary', !strong);
}

function updateFoot() {
  if (state.mode === 'recorrido') {
    fPrev.disabled = state.paso === 0;
    setNext(state.paso === PASOS.length - 1 ? 'Ir a Uso →' : 'Siguiente →');
  } else if (state.mode === 'uso') {
    fPrev.disabled = !state.usoFin && state.uso === 0;
    if (state.usoFin) setNext('Ir a Evaluación →');
    else setNext(state.uso === USO.length - 1 ? 'Terminar →' : 'Siguiente →', { strong: state.usoHecho });
  } else {
    fPrev.disabled = true;
    if (quiz.done) setNext('Siguiente →', { enabled: false });
    else setNext(quiz.isLast ? 'Ver resultado →' : 'Siguiente →', { enabled: quiz.canNext() });
  }
}

fPrev.addEventListener('click', () => {
  if (state.mode === 'recorrido') goPaso(state.paso - 1);
  else if (state.mode === 'uso') goUso(state.usoFin ? USO.length - 1 : state.uso - 1);
});
fNext.addEventListener('click', () => {
  if (state.mode === 'recorrido') {
    if (state.paso === PASOS.length - 1) setMode('uso');
    else goPaso(state.paso + 1);
  } else if (state.mode === 'uso') {
    if (state.usoFin) setMode('evaluar');
    else if (state.uso === USO.length - 1) renderUsoFinal();
    else goUso(state.uso + 1);
  } else quiz.next();
});

// ---------- Secciones ----------
function setMode(m) {
  const prev = state.mode;
  state.mode = m;
  document.body.dataset.mode = m;
  document.querySelectorAll('.mode').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  quiz.active = m === 'evaluar';
  viewer.setIsolate(false);
  viewer.setLabelsEnabled(m === 'recorrido');
  $('#hover-name').textContent = '';
  if (prev === 'uso' && m !== 'uso') { viewer.setPulse(null); viewer.resetControls(); monitor.stop(); }
  // En la práctica la pantalla simulada ocupa la esquina inferior izquierda: el encuadre se corre a la derecha
  viewer.setFocusShift(m === 'uso' ? 0.12 : 0, m === 'uso' ? 0.06 : 0);

  if (m === 'recorrido') goPaso(state.paso);
  else if (m === 'uso') {
    viewer.select(null);
    viewer.stopExplode();
    viewer.setExplode(0);
    goUso(state.usoFin ? 0 : state.uso);
  } else {
    viewer.reset();
    quiz.start();
  }
  updateFoot();
  updateBar();
  updateTools();
}
document.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

// ---------- Barra de progreso ----------
function updateBar() {
  const seg = $('#segments');
  let total, cur, done, jump = null, label;
  if (state.mode === 'recorrido') {
    total = PASOS.length; cur = state.paso;
    done = (i) => state.visto.has(PASOS[i].id);
    jump = goPaso; label = (i) => `Parte ${i + 1}: ${PASOS[i].titulo}`;
  } else if (state.mode === 'uso') {
    total = USO.length; cur = state.usoFin ? -1 : state.uso;
    done = (i) => state.usoListo.has(USO[i].id);
    jump = goUso; label = (i) => `Paso ${i + 1}: ${USO[i].titulo}`;
  } else {
    total = QUIZ.length; cur = quiz.done ? -1 : quiz.i;
    done = (i) => i < quiz.i || quiz.done;
    label = (i) => `Pregunta ${i + 1}`;
  }
  seg.innerHTML = Array.from({ length: total }, (_, i) =>
    `<button type="button" class="seg ${done(i) ? 'done' : ''} ${i === cur ? 'cur' : ''}" data-i="${i}"
      ${jump ? `title="${esc(label(i))}"` : 'tabindex="-1" disabled'} aria-label="${esc(label(i))}" ${i === cur ? 'aria-current="step"' : ''}></button>`).join('');
  seg.onclick = (e) => { const b = e.target.closest('.seg'); if (b && jump) jump(+b.dataset.i); };
}

// ---------- Herramientas del visor ----------
function updateTools() {
  const expanded = viewer.t > 0.5;
  const enabled = state.mode !== 'uso';
  document.querySelectorAll('.layer-opt').forEach((b) => {
    b.setAttribute('aria-pressed', String((b.dataset.capas === '1') === expanded));
    b.disabled = !enabled;
  });
  $('#layers').title = enabled ? '' : 'En la práctica la cámara se usa armada';
  const iso = $('#btn-iso');
  iso.disabled = state.mode !== 'recorrido';
  iso.setAttribute('aria-pressed', String(viewer.isolated));
}

const setCapas = (on) => {
  if (state.mode === 'uso') return;
  viewer.animateExplode(on ? 1 : 0);
  // En la evaluación no hay pieza enfocada: se reencuadra todo el modelo
  if (state.mode === 'evaluar') viewer.reset(on ? 1 : 0);
  else viewer.focusParts(PASOS[state.paso].partes, on ? 1 : 0, PASOS[state.paso].vista);
};
viewer.on('explode', updateTools);
document.querySelectorAll('.layer-opt').forEach((b) => b.addEventListener('click', () => setCapas(b.dataset.capas === '1')));
$('#btn-iso').addEventListener('click', () => { viewer.setIsolate(!viewer.isolated); updateTools(); });
$('#btn-reset').addEventListener('click', () => viewer.reset());
$('#btn-full').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $('#viewer').requestFullscreen();
  } catch { showNotice('Este navegador no permite pantalla completa aquí.', 'warn'); }
});

// ---------- Ayuda ----------
$('#btn-ayuda').addEventListener('click', () => $('#dlg-ayuda').showModal());
document.querySelectorAll('dialog').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
});

// ---------- Teclado ----------
document.addEventListener('keydown', (e) => {
  if ($('#app').hidden || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest('input, textarea, select, dialog[open]')) return;
  const k = e.key.toLowerCase();
  if (e.key === 'ArrowRight' && !fNext.disabled) fNext.click();
  else if (e.key === 'ArrowLeft' && !fPrev.disabled) fPrev.click();
  else if (k === 'e') setCapas(viewer.t <= 0.5);
  else if (k === 'r') viewer.reset();
  else if (k === 'i' && !$('#btn-iso').disabled) $('#btn-iso').click();
  else return;
  e.preventDefault();
});

// ---------- Avisos ----------
let noticeTimer;
function showNotice(text, kind = 'ok', ms = 9000) {
  const n = $('#notice');
  $('#notice-text').textContent = text;
  n.dataset.kind = kind;
  n.hidden = false;
  clearTimeout(noticeTimer);
  if (ms) noticeTimer = setTimeout(() => (n.hidden = true), ms);
}
$('#notice-close').addEventListener('click', () => ($('#notice').hidden = true));

// ---------- Carga del modelo ----------
viewer.on('progress', (f) => { if (f != null) $('#load-bar').style.width = `${Math.round(f * 100)}%`; });
viewer.on('loaded', ({ provisional, name, missingParts, missingCtrls }) => {
  $('#loading').hidden = true;
  $('#badge').hidden = !provisional;
  if (!provisional) {
    const faltan = [...missingParts.map((p) => p.mesh), ...missingCtrls];
    if (faltan.length) showNotice(`Se cargó «${name}». Faltan ${faltan.length} objetos con el nombre esperado: ${faltan.join(', ')}.`, 'warn', 0);
    else showNotice(`Se cargó «${name}». Están todas las piezas y controles.`, 'ok');
  }
  if (!$('#app').hidden) setMode(state.mode);
});

async function loadFile(file) {
  if (!file) return;
  $('#dlg-ayuda').close();
  if (!/\.glb$/i.test(file.name)) return showNotice('Usa un archivo .glb (glTF binario, con texturas incluidas).', 'warn');
  $('#loading').hidden = false;
  try { await viewer.load(file, file.name); }
  catch (err) { $('#loading').hidden = true; showNotice(`No se pudo leer «${file.name}»: ${err.message}`, 'warn', 0); }
}
$('#glb-input').addEventListener('change', (e) => { loadFile(e.target.files[0]); e.target.value = ''; });
const vEl = $('#viewer'), drop = $('#drop');
vEl.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); drop.hidden = false; } });
vEl.addEventListener('dragleave', (e) => { if (!vEl.contains(e.relatedTarget)) drop.hidden = true; });
vEl.addEventListener('drop', (e) => { e.preventDefault(); drop.hidden = true; loadFile(e.dataTransfer.files[0]); });

// Inicio: intenta el modelo final y, si aún no existe, usa el provisional
(async () => {
  try { await viewer.load(CONFIG.modelUrl, 'z90.glb'); }
  catch { viewer.usePlaceholder(); }
})();
