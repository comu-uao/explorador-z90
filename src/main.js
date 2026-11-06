// Interfaz: portada, secciones (recorrido, uso, laboratorio, evaluación), ficha con pie fijo,
// idioma, narración, video, lista, realidad aumentada y certificado.
// Fuentes alojadas en el propio sitio (no dependen de Google Fonts)
import '@fontsource/rubik/latin-400.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './style.css';
import { CONFIG } from './config.js';
import { EQUIPO_ACTUAL as EQ, contenido } from './equipos/index.js';
import { t, getLang, setLang, onLang, aplicar } from './i18n/index.js';
import { Viewer } from './viewer.js';
import { Quiz } from './quiz.js';
import { Monitor } from './monitor.js';
import { stats } from './stats.js';
import { hablar, callar, vozDisponible, hablando } from './voz.js';
import { crearVideo } from './video.js';
import { crearLista } from './lista.js';
import { crearAR } from './ar.js';
import { crearCertificado } from './certificado.js';
import { crearExposicion } from './lab/exposicion.js';
import { crearMenu } from './lab/menu.js';
import { crearErrores } from './lab/errores.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NOTA_MINIMA = 0.75;

// ---------- Contenido según idioma ----------
let C, PASOS, USO, QUIZ, pasoById, pasoDeParte;
function indexar() {
  C = contenido(EQ, getLang());
  PASOS = C.recorrido; USO = C.uso; QUIZ = C.quiz;
  PASOS.forEach((s, i) => (s.n = i + 1));
  pasoById = Object.fromEntries(PASOS.map((s) => [s.id, s]));
  pasoDeParte = {};
  PASOS.forEach((s) => s.partes.forEach((p) => (pasoDeParte[p] = s.id)));
  EQ.partes.forEach((p) => { const s = pasoById[pasoDeParte[p.id]]; p.n = s?.n ?? '·'; p.titulo = s?.titulo ?? p.id; });
}
indexar();
const CONTROLES = [...new Set(EQ.contenido.uso.flatMap((u) => [u.control, ...u.acciones.map((a) => a.objeto)]))];

// ---------- Estado ----------
// El avance vive solo en memoria: se reinicia al recargar la página o al volver a comenzar.
// (Se borran también los datos que guardaban versiones anteriores.)
try { ['z90-progreso', 'z90-lista', 'z90-cert'].forEach((k) => localStorage.removeItem(k)); } catch { /* sin almacenamiento */ }
const estadoInicial = () => ({
  mode: 'recorrido', paso: 0, uso: 0, usoHecho: false, usoFin: false, lab: 'exp',
  visto: new Set(), usoListo: new Set(), quizGuardado: false, iniciado: false,
});
const state = estadoInicial();
const save = () => {};

const body = $('#ficha');
const fPrev = $('#f-prev'), fNext = $('#f-next');
const viewer = new Viewer($('#stage'), EQ.partes, CONTROLES);
window.explorador = { viewer };   // para pruebas desde la consola
const monitor = new Monitor($('#monitor'));
const video = crearVideo({ equipo: EQ, t, getLang });
const lista = crearLista({ t, urlPublica: CONFIG.urlPublica });
lista.setItems(C.lab.lista);
const ar = crearAR({ viewer, equipo: EQ, t, urlPublica: CONFIG.urlPublica });

const requisitos = () => [
  { ok: PASOS.every((s) => state.visto.has(s.id)), texto: t('cert.req.rec', { n: PASOS.filter((s) => state.visto.has(s.id)).length, total: PASOS.length }) },
  { ok: USO.every((u) => state.usoListo.has(u.id)), texto: t('cert.req.uso', { n: USO.filter((u) => state.usoListo.has(u.id)).length, total: USO.length }) },
  { ok: stats.sesion().mejor >= NOTA_MINIMA, texto: t('cert.req.eval', { min: Math.round(NOTA_MINIMA * 100), mejor: Math.round(stats.sesion().mejor * 100) }) },
];
const cert = crearCertificado({ t, getLang, equipo: EQ, requisitos, minimo: NOTA_MINIMA });

const quiz = new Quiz(body, QUIZ, pasoById, {
  onShow: (id) => {
    if (!id) { viewer.select(null); return; }
    const s = pasoById[id];
    viewer.select(s.partes);
    viewer.focusParts(s.partes, viewer.t, s.vista);
  },
  onReview: (id) => { state.paso = PASOS.indexOf(pasoById[id]); setMode('recorrido'); },
  onChange: () => {
    if (quiz.done) {
      if (!state.quizGuardado) { stats.quizTerminado(quiz.score, quiz.n); state.quizGuardado = true; }
      const slot = body.querySelector('#cert-slot');
      if (slot) slot.innerHTML = cert.bloque();
    } else state.quizGuardado = false;
    updateFoot(); updateBar();
  },
}, CONFIG.evaluacion);
window.explorador.quiz = quiz;

// ---------- Laboratorio ----------
const labCtx = (extra = {}) => ({ t, imagenes: EQ.imagenes, stats, onCambio: labCambio, ...extra });
const LABS = {
  exp: crearExposicion(labCtx()),
  menu: crearMenu(labCtx()),
  err: crearErrores(labCtx({ titulo: (id) => pasoById[id]?.titulo || id })),
};
const ORDEN_LABS = ['exp', 'menu', 'err'];
function datosLab() {
  LABS.exp.setDatos(C.lab.exposicion);
  LABS.menu.setDatos(C.lab.menu);
  LABS.err.setDatos(C.lab.errores);
}
datosLab();
function montarLabs() { for (const id of ORDEN_LABS) LABS[id].montar(document.querySelector(`.lab-pane[data-pane="${id}"]`)); }
montarLabs();
function labCambio({ rerender }) { if (rerender && state.mode === 'lab') renderLab(); else { updateFoot(); updateBar(); } }

// ---------- Portada ----------
$('#btn-start').addEventListener('click', () => entrar());
// Volver a comenzar borra todo el avance: recorrido, práctica, laboratorio, evaluación, lista y constancia.
function reiniciarTodo() {
  Object.assign(state, estadoInicial());
  stats.nuevaSesion();
  for (const id of ORDEN_LABS) LABS[id].limpiar();
  lista.limpiar();
  cert.limpiar();
  quiz.active = false;
  quiz.usos.clear();
  viewer.setPulse(null);
  viewer.resetControls();
  viewer.setIsolate(false);
  viewer.stopExplode();
  viewer.setExplode(0);
  monitor.stop();
  monitor.set({});
}
function entrar() {
  if (!$('#app').hidden) return;
  if (state.iniciado) reiniciarTodo();
  state.iniciado = true;
  document.body.classList.remove('con-avance');
  $('#inicio').hidden = true;
  $('#app').hidden = false;
  setMode(state.mode);
  body.focus({ preventScroll: true });
}
$('#btn-home').addEventListener('click', () => {
  callar();
  $('#app').hidden = true;
  $('#inicio').hidden = false;
  document.body.classList.add('con-avance');
  $('#btn-start').focus();
});

// ---------- Piezas comunes de la ficha ----------
function foto(id, pie, min) {
  const src = id && EQ.fotos[id];
  if (!src) return '';
  return `<figure class="ref">
    <img src="${src}" alt="${esc(pie || t('ref.real'))}" width="480" height="270" loading="lazy">
    <figcaption><span>${esc(pie || t('ref.real'))}</span>${min ? `<b>${t('ref.tutorial', { min })}</b>` : ''}</figcaption>
  </figure>`;
}
let textoVoz = '';
function herramientas(texto, min, hasta) {
  textoVoz = texto;
  return `<div class="ficha-tools">
    <button type="button" class="btn small secondary" data-voz aria-pressed="false" ${vozDisponible ? '' : 'disabled'} aria-label="${t('voz.escuchar')}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10z"/><path class="onda1" d="M16 9a4 4 0 0 1 0 6"/><path class="onda2" d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>
      <span>${t('voz.escuchar')}</span>
    </button>
    <button type="button" class="btn small secondary" data-video="${min || ''}" data-hasta="${hasta || ''}" ${min && video.disponible ? '' : 'disabled'}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9v6l5-3z"/></svg>
      <span>${t('video.corto')}${min ? ' · ' + min : ''}</span>
    </button>
  </div>`;
}
function vozPulsada(b) {
  if (hablando()) { callar(); b.setAttribute('aria-pressed', 'false'); return; }
  b.setAttribute('aria-pressed', 'true');
  b.setAttribute('aria-label', t('voz.detener'));
  hablar(textoVoz, getLang(), () => { b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', t('voz.escuchar')); });
}

// ---------- Recorrido ----------
function renderPaso(s) {
  callar();
  body.innerHTML = `
    <p class="eyebrow">${t('rec.eyebrow', { n: s.n, total: PASOS.length })}</p>
    <h2 tabindex="-1"><span class="num">${s.n}</span>${esc(s.titulo)}</h2>
    ${herramientas([s.titulo, s.que_es, s.para_que, `${t('tip')}: ${s.tip}`].join('. '), s.min, s.hasta)}
    <div class="qa"><h3>${t('rec.que')}</h3><p>${esc(s.que_es)}</p></div>
    <div class="qa"><h3>${t('rec.para')}</h3><p>${esc(s.para_que)}</p></div>
    <div class="tip"><span class="tip-tag">${t('tip')}</span><p>${esc(s.tip)}</p></div>
    ${foto(s.foto, s.foto_pie, s.min)}`;
}

function goPaso(i) {
  i = Math.max(0, Math.min(PASOS.length - 1, i));
  state.paso = i;
  const s = PASOS[i];
  const tt = s.despiece ?? (viewer.t > 0.5 ? 1 : 0);
  viewer.select(s.partes);
  viewer.animateExplode(tt);
  viewer.focusParts(s.partes, tt, s.vista);
  state.visto.add(s.id);
  save();
  renderPaso(s);
  updateFoot(); updateBar(); updateTools();
}

// ---------- Uso de la cámara ----------
function pantallaHasta(k) { const s = {}; for (let i = 0; i < k; i++) Object.assign(s, USO[i].pantalla); return s; }

async function goUso(k) {
  k = Math.max(0, Math.min(USO.length - 1, k));
  state.uso = k; state.usoHecho = false; state.usoFin = false;
  viewer.resetControls();
  USO.forEach((u) => viewer.setInitial(u.acciones));
  for (let i = 0; i < k; i++) await viewer.runActions(USO[i].acciones, true);
  monitor.set(pantallaHasta(k));
  const u = USO[k];
  viewer.setPulse(u.control, u.parte);
  viewer.focusControl(u.control, u.vista, u.parte);
  renderUso();
  updateFoot(); updateBar();
}

function renderUso(pista = '') {
  callar();
  const u = USO[state.uso];
  const head = `
    <p class="eyebrow">${t('uso.eyebrow', { n: state.uso + 1, total: USO.length })}</p>
    <h2 tabindex="-1"><span class="num">${state.uso + 1}</span>${esc(u.titulo)}</h2>`;
  const ref = foto(u.foto, t('uso.asi'), u.min);
  if (state.usoHecho) {
    body.innerHTML = `${head}${herramientas(`${u.titulo}. ${u.hecho}`, u.min, u.hasta)}
      <div class="status ok"><span class="status-mark" aria-hidden="true">✓</span><p>${esc(u.hecho)}</p></div>
      <button type="button" class="btn secondary" data-uso="repetir">${t('uso.repetir')}</button>
      ${ref}`;
  } else {
    body.innerHTML = `${head}${herramientas(`${u.titulo}. ${u.instruccion}`, u.min, u.hasta)}
      <p class="instr">${esc(u.instruccion)}</p>
      <div class="status ${pista ? 'warn' : 'info'}" role="status">
        <span class="status-mark" aria-hidden="true">${pista ? '!' : ''}</span>
        <p>${pista ? esc(pista) : t('uso.hint')}</p>
      </div>
      <button type="button" class="btn secondary" data-uso="mostrar">${t('uso.mostrar')}</button>
      ${ref}`;
  }
}

function renderUsoFinal() {
  callar();
  state.usoFin = true;
  viewer.setPulse(null);
  body.innerHTML = `
    <p class="eyebrow">${t('uso.fin.eyebrow')}</p>
    <h2 tabindex="-1">${t('uso.fin.titulo')}</h2>
    <p class="resumen">${t('uso.fin.resumen')}</p>
    <div class="green-box sm"><p>${t('uso.fin.orden')}</p></div>
    <p class="resumen">${t('uso.fin.lab')}</p>
    <div class="lab-acciones">
      <button type="button" class="btn secondary" data-uso="reiniciar">${t('uso.reiniciar')}</button>
      <button type="button" class="btn secondary" data-lista-abrir>${t('lista.abrir')}</button>
    </div>`;
  updateFoot(); updateBar();
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

const nombreDe = (part) => pasoById[pasoDeParte[part]]?.titulo || t('q.otra');

// ---------- Laboratorio: ficha ----------
function renderLab() {
  callar();
  const L = LABS[state.lab];
  body.innerHTML = `
    <div class="subtabs" role="tablist" aria-label="${t('lab.aria')}">
      ${ORDEN_LABS.map((id) => `<button type="button" role="tab" data-sub="${id}" aria-selected="${id === state.lab}">${t('lab.' + id)}</button>`).join('')}
    </div>
    <div class="lab-panel">${L.panelHTML()}</div>`;
  L.enlazar(body.querySelector('.lab-panel'));
  document.querySelectorAll('.lab-pane').forEach((p) => (p.hidden = p.dataset.pane !== state.lab));
  L.mostrar();
  updateFoot(); updateBar();
}
function setLab(id) { state.lab = id; renderLab(); }

// ---------- Clics en el modelo ----------
viewer.on('pick', ({ part, control }) => {
  if (state.mode === 'evaluar') return quiz.pick(pasoDeParte[part]);
  if (state.mode === 'uso') {
    if (state.usoHecho || state.usoFin || !part) return;
    const u = USO[state.uso];
    const ok = control === u.control || (!viewer.hasControl(u.control) && part === u.parte);
    if (ok) completarUso();
    else renderUso(t('uso.pista', { parte: nombreDe(part), pista: u.pista }));
    return;
  }
  if (part && state.mode === 'recorrido') goPaso(PASOS.indexOf(pasoById[pasoDeParte[part]]));
});
viewer.on('hover', (id) => { $('#hover-name').textContent = id && state.mode === 'recorrido' ? nombreDe(id) : ''; });

body.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.hasAttribute('data-voz')) vozPulsada(b);
  else if (b.dataset.video != null && b.dataset.video !== '') { callar(); const h2 = body.querySelector('h2'); const titulo = h2 ? [...h2.childNodes].filter((n) => !n.classList?.contains('num')).map((n) => n.textContent).join('').trim() : '';
    video.abrir(b.dataset.video, titulo, b.dataset.hasta); }
  else if (b.dataset.uso === 'mostrar') completarUso();
  else if (b.dataset.uso === 'repetir') goUso(state.uso);
  else if (b.dataset.uso === 'reiniciar') { state.usoListo.clear(); save(); goUso(0); }
  else if (b.hasAttribute('data-lista-abrir')) lista.abrir();
  else if (b.dataset.sub) setLab(b.dataset.sub);
  else if (b.dataset.repasar) { state.paso = PASOS.indexOf(pasoById[b.dataset.repasar]); setMode('recorrido'); }
  else if (b.dataset.cert === 'generar') {
    const inp = body.querySelector('#cert-nombre');
    const nombre = inp.value.trim().replace(/\s+/g, ' ');
    if (nombre.length < 3) { inp.setAttribute('aria-invalid', 'true'); inp.focus(); inp.placeholder = t('cert.nombre.falta'); return; }
    inp.removeAttribute('aria-invalid');
    cert.generar(nombre, stats.sesion().mejor);
  }
});

// ---------- Pie de la ficha ----------
function setNext(label, { enabled = true, strong = true } = {}) {
  fNext.textContent = label;
  fNext.disabled = !enabled;
  fNext.classList.toggle('primary', strong);
  fNext.classList.toggle('secondary', !strong);
}
function labPos() { const k = ORDEN_LABS.indexOf(state.lab); const L = LABS[state.lab]; return { k, L, i: L.actual(), n: L.total() }; }

function updateFoot() {
  fPrev.textContent = t('nav.anterior');
  if (state.mode === 'recorrido') {
    fPrev.disabled = state.paso === 0;
    setNext(state.paso === PASOS.length - 1 ? t('nav.ir.uso') : t('nav.siguiente'));
  } else if (state.mode === 'uso') {
    fPrev.disabled = !state.usoFin && state.uso === 0;
    if (state.usoFin) setNext(t('nav.ir.lab'));
    else setNext(state.uso === USO.length - 1 ? t('nav.terminar') : t('nav.siguiente'), { strong: state.usoHecho });
  } else if (state.mode === 'lab') {
    const { k, i, n } = labPos();
    fPrev.disabled = k === 0 && i === 0;
    if (i < n - 1) setNext(t('nav.siguiente'), { strong: LABS[state.lab].hecho(i) });
    else setNext(k < ORDEN_LABS.length - 1 ? t('nav.sig.lab') : t('nav.ir.eval'), { strong: LABS[state.lab].hecho(i) });
  } else {
    fPrev.disabled = true;
    if (quiz.done) setNext(t('nav.siguiente'), { enabled: false });
    else setNext(quiz.isLast ? t('nav.resultado') : t('nav.siguiente'), { enabled: quiz.canNext() });
  }
}

fPrev.addEventListener('click', () => {
  if (state.mode === 'recorrido') goPaso(state.paso - 1);
  else if (state.mode === 'uso') goUso(state.usoFin ? USO.length - 1 : state.uso - 1);
  else if (state.mode === 'lab') {
    const { k, i, L } = labPos();
    if (i > 0) L.ir(i - 1);
    else if (k > 0) { state.lab = ORDEN_LABS[k - 1]; LABS[state.lab].ir(LABS[state.lab].total() - 1); }
  }
});
fNext.addEventListener('click', () => {
  if (state.mode === 'recorrido') { if (state.paso === PASOS.length - 1) setMode('uso'); else goPaso(state.paso + 1); }
  else if (state.mode === 'uso') {
    if (state.usoFin) setMode('lab');
    else if (state.uso === USO.length - 1) renderUsoFinal();
    else goUso(state.uso + 1);
  } else if (state.mode === 'lab') {
    const { k, i, n, L } = labPos();
    if (i < n - 1) L.ir(i + 1);
    else if (k < ORDEN_LABS.length - 1) { state.lab = ORDEN_LABS[k + 1]; LABS[state.lab].ir(0); }
    else setMode('evaluar');
  } else quiz.next();
});

// ---------- Secciones ----------
function setMode(m) {
  const prev = state.mode;
  state.mode = m;
  callar();
  document.body.dataset.mode = m;
  document.querySelectorAll('.mode').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  quiz.active = m === 'evaluar';
  viewer.setIsolate(false);
  viewer.setLabelsEnabled(m === 'recorrido');
  $('#hover-name').textContent = '';
  if (prev === 'uso' && m !== 'uso') { viewer.setPulse(null); viewer.resetControls(); monitor.stop(); }
  viewer.setFocusShift(m === 'uso' ? 0.12 : 0, m === 'uso' ? 0.06 : 0);

  if (m === 'recorrido') goPaso(state.paso);
  else if (m === 'uso') {
    viewer.select(null); viewer.stopExplode(); viewer.setExplode(0);
    goUso(state.usoFin ? 0 : state.uso);
  } else if (m === 'lab') {
    viewer.select(null);
    renderLab();
  } else { viewer.reset(); quiz.start(); }
  updateFoot(); updateBar(); updateTools();
}
document.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

// ---------- Barra de progreso ----------
function updateBar() {
  const seg = $('#segments');
  let total, cur, done, jump = null, label;
  if (state.mode === 'recorrido') {
    total = PASOS.length; cur = state.paso;
    done = (i) => state.visto.has(PASOS[i].id); jump = goPaso;
    label = (i) => `${t('seg.parte', { n: i + 1 })}: ${PASOS[i].titulo}`;
  } else if (state.mode === 'uso') {
    total = USO.length; cur = state.usoFin ? -1 : state.uso;
    done = (i) => state.usoListo.has(USO[i].id); jump = goUso;
    label = (i) => `${t('seg.paso', { n: i + 1 })}: ${USO[i].titulo}`;
  } else if (state.mode === 'lab') {
    const L = LABS[state.lab];
    total = L.total(); cur = L.actual(); done = (i) => L.hecho(i); jump = (i) => L.ir(i);
    label = (i) => t('seg.item', { n: i + 1 });
  } else {
    total = quiz.n || CONFIG.evaluacion.total; cur = quiz.done ? -1 : quiz.i;
    done = (i) => i < quiz.i || quiz.done;
    label = (i) => t('seg.pregunta', { n: i + 1 });
  }
  seg.innerHTML = Array.from({ length: total }, (_, i) =>
    `<button type="button" class="seg ${done(i) ? 'done' : ''} ${i === cur ? 'cur' : ''}" data-i="${i}"
      ${jump ? `title="${esc(label(i))}"` : 'tabindex="-1" disabled'} aria-label="${esc(label(i))}" ${i === cur ? 'aria-current="step"' : ''}></button>`).join('');
  seg.onclick = (e) => { const b = e.target.closest('.seg'); if (b && jump) jump(+b.dataset.i); };
}

// ---------- Herramientas del visor ----------
function updateTools() {
  const expanded = viewer.t > 0.5;
  const capasOn = state.mode !== 'uso';
  document.querySelectorAll('.layer-opt').forEach((b) => {
    b.setAttribute('aria-pressed', String((b.dataset.capas === '1') === expanded));
    b.disabled = !capasOn;
  });
  $('#layers').title = capasOn ? '' : t('capas.bloqueado');
  const iso = $('#btn-iso');
  iso.disabled = state.mode !== 'recorrido';
  iso.setAttribute('aria-pressed', String(viewer.isolated));
  $('#btn-ar').disabled = state.mode === 'uso';
}

const setCapas = (on) => {
  if (state.mode === 'uso' || state.mode === 'lab') return;
  viewer.animateExplode(on ? 1 : 0);
  if (state.mode === 'evaluar') viewer.reset(on ? 1 : 0);
  else viewer.focusParts(PASOS[state.paso].partes, on ? 1 : 0, PASOS[state.paso].vista);
};
viewer.on('explode', updateTools);
document.querySelectorAll('.layer-opt').forEach((b) => b.addEventListener('click', () => setCapas(b.dataset.capas === '1')));
$('#btn-iso').addEventListener('click', () => { viewer.setIsolate(!viewer.isolated); updateTools(); });
$('#btn-reset').addEventListener('click', () => viewer.reset());
$('#btn-ar').addEventListener('click', () => { callar(); ar.abrir(); });
$('#btn-full').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $('#viewer').requestFullscreen();
  } catch { showNotice(t('aviso.full'), 'warn'); }
});

// ---------- Lista, ayuda, idioma ----------
document.querySelectorAll('[data-abrir="lista"]').forEach((b) => b.addEventListener('click', () => lista.abrir()));
$('#btn-ayuda').addEventListener('click', () => $('#dlg-ayuda').showModal());
document.querySelectorAll('dialog').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
});
document.querySelectorAll('.lang').forEach((g) => g.addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); }));

onLang(() => {
  callar();
  indexar();
  viewer.refreshTitles();
  lista.setItems(C.lab.lista);
  datosLab();
  montarLabs();
  quiz.qs = QUIZ;
  quiz.byId = pasoById;
  monitor.relabel();
  video.idioma();
  if (!$('#app').hidden) {
    if (state.mode === 'recorrido') renderPaso(PASOS[state.paso]);
    else if (state.mode === 'uso') { if (state.usoFin) renderUsoFinal(); else renderUso(); }
    else if (state.mode === 'lab') renderLab();
    else quiz.render();
    updateFoot(); updateBar(); updateTools();
  }
});

// ---------- Teclado ----------
document.addEventListener('keydown', (e) => {
  if ($('#app').hidden || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest('input, textarea, select, dialog[open]')) return;
  const k = e.key.toLowerCase();
  if (state.mode === 'lab' && state.lab === 'menu') {
    const mapa = { arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right', enter: 'ok', ' ': 'ok', m: 'menu', escape: 'menu' };
    if (mapa[k] && !e.target.closest('button:not(.dp):not(.ml-menubtn)')) { e.preventDefault(); LABS.menu.tecla(mapa[k]); return; }
  }
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
let alCargar = [];
viewer.on('progress', (f) => { if (f != null) $('#load-bar').style.width = `${Math.round(f * 100)}%`; });
viewer.on('loaded', ({ provisional, name, missingParts, missingCtrls }) => {
  $('#loading').hidden = true;
  $('#badge').hidden = !provisional;
  if (!provisional) {
    const faltan = [...missingParts.map((p) => p.mesh), ...missingCtrls];
    if (faltan.length) showNotice(t('aviso.faltan', { name, n: faltan.length, lista: faltan.join(', ') }), 'warn', 0);
    else showNotice(t('aviso.completo', { name }), 'ok');
  }
  if (!$('#app').hidden) setMode(state.mode);
  alCargar.forEach((f) => f()); alCargar = [];
});

async function loadFile(file) {
  if (!file) return;
  $('#dlg-ayuda').close();
  if (!/\.glb$/i.test(file.name)) return showNotice(t('aviso.glb'), 'warn');
  $('#loading').hidden = false;
  try { await viewer.load(file, file.name); }
  catch (err) { $('#loading').hidden = true; showNotice(t('aviso.noleer', { name: file.name, err: err.message }), 'warn', 0); }
}
$('#glb-input').addEventListener('change', (e) => { loadFile(e.target.files[0]); e.target.value = ''; });
const vEl = $('#viewer'), drop = $('#drop');
vEl.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); drop.hidden = false; } });
vEl.addEventListener('dragleave', (e) => { if (!vEl.contains(e.relatedTarget)) drop.hidden = true; });
vEl.addEventListener('drop', (e) => { e.preventDefault(); drop.hidden = true; loadFile(e.dataTransfer.files[0]); });

// ---------- Arranque ----------
aplicar();
(async () => {
  try { await viewer.load(EQ.modelo, 'z90.glb'); }
  catch { viewer.usePlaceholder(EQ.placeholder); }
})();

// Enlaces directos: #lista (QR del estuche), #ar (abrir en el celular)
const ruta = location.hash.replace('#', '');
if (ruta === 'lista') lista.abrir();
else if (ruta === 'ar') { entrar(); alCargar.push(() => ar.abrir()); }
