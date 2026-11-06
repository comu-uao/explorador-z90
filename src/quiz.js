// Evaluación: identificar (clic en el modelo), opción múltiple y ordenar.
// Cada intento saca preguntas al azar del banco (src/equipos/<equipo>/es/quiz.json) y mezcla sus opciones.
// Solo dibuja el contenido de la ficha. La navegación (Siguiente) la maneja el pie de la ficha.
// El estado guarda ids e índices, no textos: así se puede cambiar de idioma en medio de una pregunta.

import { t } from './i18n/index.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
const indices = (n) => Array.from({ length: n }, (_, i) => i);
const tema = (q) => q.respuesta || q.parte || q.id;

export class Quiz {
  // banco: todas las preguntas (cada una con id). byId: pasos del recorrido por id (cada uno con .titulo).
  // mezcla: cuántas preguntas de cada tipo lleva un intento.
  constructor(el, banco, byId, { onShow, onReview, onChange, onAnswer }, mezcla = {}) {
    Object.assign(this, { el, qs: banco, byId, onShow, onReview, onChange, onAnswer });
    this.mezcla = { total: 8, identificar: 2, ordenar: 1, ...mezcla };
    this.active = false;
    this.usos = new Map();        // cuántas veces salió cada pregunta en esta visita: primero salen las que menos
    this.sel = [];
    el.addEventListener('click', (e) => this.click(e));
  }

  get n() { return this.sel.length; }
  get cur() { return this.sel[this.i]; }
  get q() { const c = this.cur; return c && this.qs.find((x) => x.id === c.id); }
  get done() { return this.i >= this.n; }
  get isLast() { return this.i === this.n - 1; }
  canNext() { return !this.done && this.answered; }

  // Elige las preguntas de un intento: por tipo, primero las que menos han salido en esta visita,
  // y repartidas entre las partes de la cámara (una por parte mientras alcancen).
  elegir() {
    const { total, identificar, ordenar } = this.mezcla;
    const orden = (lista) => shuffle(lista).sort((a, b) => (this.usos.get(a.id) || 0) - (this.usos.get(b.id) || 0));
    const usados = new Map();
    const tomar = (lista, cuantos, max = 1) => {
      const out = [];
      for (const pasada of [max, Infinity]) {
        for (const q of orden(lista)) {
          if (out.length >= cuantos) break;
          if (out.includes(q) || (usados.get(tema(q)) || 0) >= pasada) continue;
          out.push(q);
          usados.set(tema(q), (usados.get(tema(q)) || 0) + 1);
        }
      }
      return out;
    };
    const de = (tipo) => this.qs.filter((q) => q.tipo === tipo);
    const elegidas = [...tomar(de('identificar'), identificar), ...tomar(de('ordenar'), ordenar)];
    elegidas.push(...tomar(de('opcion'), total - elegidas.length));
    if (elegidas.length < total) elegidas.push(...tomar(this.qs.filter((q) => !elegidas.includes(q)), total - elegidas.length, Infinity));
    return shuffle(elegidas);
  }

  start() {
    const elegidas = this.elegir();
    elegidas.forEach((q) => this.usos.set(q.id, (this.usos.get(q.id) || 0) + 1));
    this.sel = elegidas.map((q) => ({ id: q.id, perm: q.tipo === 'opcion' ? shuffle(indices(q.opciones.length)) : null }));
    this.i = 0;
    this.score = 0;
    this.missed = [];
    this.prepare();
    this.render();
  }

  next() {
    if (!this.canNext()) return;
    this.i++;
    this.prepare();
    this.render();
    this.el.querySelector('h2')?.focus();
  }

  prepare() {
    this.answered = false;
    this.feedback = null;
    if (this.q?.tipo === 'ordenar') {
      const ids = indices(this.q.items.length);
      let o = shuffle(ids);
      while (o.join() === ids.join()) o = shuffle(ids);
      this.order = o;
    }
    this.onShow(null);
  }

  // stepId: parte del recorrido a la que pertenece la pieza tocada
  pick(stepId) {
    if (!stepId || this.answered || this.q?.tipo !== 'identificar') return;
    this.finish(stepId === this.q.respuesta, stepId);
  }

  // given: índice de la opción elegida o id del paso tocado (nunca texto, para poder cambiar de idioma)
  finish(ok, given) {
    this.answered = true;
    if (ok) this.score++;
    else this.missed.push(this.q.id);
    this.feedback = { ok, given };
    this.onAnswer?.(this.q, ok);
    const id = this.q.respuesta || this.q.parte;
    if (id && this.byId[id]) this.onShow(id);
    this.render();
  }

  etiqueta(item) { return this.byId[item]?.titulo ?? item; }

  click(e) {
    const b = e.target.closest('button');
    if (!this.active || !b) return;
    const q = this.q;
    if (b.dataset.opt != null && !this.answered) this.finish(+b.dataset.opt === q.correcta, +b.dataset.opt);
    else if (b.dataset.mv) {
      const [k, d] = b.dataset.mv.split(':').map(Number);
      const j = k + d;
      if (j < 0 || j >= this.order.length) return;
      [this.order[k], this.order[j]] = [this.order[j], this.order[k]];
      this.render();
      this.el.querySelector(`[data-mv="${j}:${d}"]:not(:disabled)`)?.focus();
    } else if (b.dataset.q === 'check') this.finish(this.order.every((v, k) => v === k));
    else if (b.dataset.q === 'restart') this.start();
    else if (b.dataset.review) this.onReview(b.dataset.review);
  }

  render() {
    if (this.done) return this.renderResult();
    const q = this.q;
    let body = '';
    if (q.tipo === 'identificar') {
      body = `<p class="q-hint">${t('q.hint')}</p>`;
    } else if (q.tipo === 'opcion') {
      body = `<div class="q-opts">${this.cur.perm.map((k) => {
        const o = q.opciones[k];
        let cls = '';
        if (this.answered) cls = k === q.correcta ? 'right' : (this.feedback.given === k ? 'wrong' : '');
        const mark = cls === 'right' ? `<span class="q-mark" aria-label="${t('q.correcta')}">✓</span>` : cls === 'wrong' ? `<span class="q-mark" aria-label="${t('q.incorrecta')}">✕</span>` : '<span class="q-mark" aria-hidden="true"></span>';
        return `<button type="button" class="q-opt ${cls}" data-opt="${k}" ${this.answered ? 'disabled' : ''}><span>${esc(o)}</span>${mark}</button>`;
      }).join('')}</div>`;
    } else if (q.tipo === 'ordenar') {
      const list = this.answered ? indices(q.items.length) : this.order;
      body = `<ol class="q-order">${list.map((idx, k) => {
        const nm = esc(this.etiqueta(q.items[idx]));
        return `
        <li><span class="nm">${nm}</span>
        <span class="mv">
          <button type="button" class="icon" data-mv="${k}:-1" aria-label="${t('q.subir', { x: nm })}" ${this.answered || k === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="icon" data-mv="${k}:1" aria-label="${t('q.bajar', { x: nm })}" ${this.answered || k === list.length - 1 ? 'disabled' : ''}>↓</button>
        </span></li>`;
      }).join('')}</ol>
        <button type="button" class="btn secondary" data-q="check" ${this.answered ? 'disabled' : ''}>${t('q.check')}</button>`;
    }

    let fb = '';
    if (this.answered) {
      const f = this.feedback;
      const extra = q.tipo === 'identificar' && !f.ok
        ? `<p>${t('q.tocaste', { a: esc(this.byId[f.given]?.titulo || t('q.otra')), b: esc(this.byId[q.respuesta].titulo) })}</p>` : '';
      fb = `<div class="q-fb ${f.ok ? 'ok' : 'bad'}" role="status">
        <p class="q-fb-t">${f.ok ? t('q.ok') : t('q.bad')}</p>${extra}<p>${esc(q.explicacion)}</p></div>`;
    }

    this.el.innerHTML = `
      <p class="eyebrow">${t('q.eyebrow', { n: this.i + 1, total: this.n })}</p>
      <h2 tabindex="-1">${esc(q.pregunta)}</h2>
      ${body}${fb}`;
    this.onChange?.();
  }

  renderResult() {
    const n = this.n;
    const pct = Math.round((this.score / n) * 100);
    const msg = pct >= 85 ? t('q.msg.alto') : pct >= 60 ? t('q.msg.medio') : t('q.msg.bajo');
    const ids = [...new Set(this.missed.map((id) => { const q = this.qs.find((x) => x.id === id); return q?.respuesta || q?.parte; }).filter((id) => id && this.byId[id]))];
    this.onShow(null);
    this.el.innerHTML = `
      <p class="eyebrow">${t('q.result')}</p>
      <h2 tabindex="-1"><span class="score">${this.score}/${n}</span> ${t('q.correctas')}</h2>
      <p class="resumen">${msg}</p>
      ${ids.length ? `<div class="review"><p class="eyebrow">${t('q.repasar')}</p>
        ${ids.map((id) => `<button type="button" class="btn secondary" data-review="${id}">${esc(this.byId[id].titulo)}</button>`).join('')}</div>` : ''}
      <button type="button" class="btn secondary" data-q="restart">${t('q.repetir')}</button>
      <p class="nota">${t('q.nuevas')}</p>
      <div id="cert-slot"></div>`;
    this.el.querySelector('h2')?.focus();
    this.onChange?.();
  }
}
