// Evaluación: identificar (clic en el modelo), opción múltiple y ordenar.
// Solo dibuja el contenido de la ficha. La navegación (Siguiente) la maneja el pie de la ficha.

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

export class Quiz {
  // byId: pasos del recorrido por id (cada uno con .titulo)
  constructor(el, questions, byId, { onShow, onReview, onChange, onAnswer }) {
    Object.assign(this, { el, qs: questions, byId, onShow, onReview, onChange, onAnswer });
    this.active = false;
    el.addEventListener('click', (e) => this.click(e));
  }

  get q() { return this.qs[this.i]; }
  get done() { return this.i >= this.qs.length; }
  get isLast() { return this.i === this.qs.length - 1; }
  canNext() { return !this.done && this.answered; }

  start() {
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
      let o = shuffle(this.q.items);
      while (o.join() === this.q.items.join()) o = shuffle(this.q.items);
      this.order = o;
    }
    this.onShow(null);
  }

  // stepId: parte del recorrido a la que pertenece la pieza tocada
  pick(stepId) {
    if (!stepId || this.answered || this.q?.tipo !== 'identificar') return;
    this.finish(stepId === this.q.respuesta, this.byId[stepId]?.titulo);
  }

  finish(ok, given) {
    this.answered = true;
    if (ok) this.score++;
    else this.missed.push(this.q);
    this.feedback = { ok, given };
    this.onAnswer?.(this.i, ok);
    const id = this.q.respuesta || this.q.parte;
    if (id) this.onShow(id);
    this.render();
  }

  click(e) {
    const b = e.target.closest('button');
    if (!this.active || !b) return;
    const q = this.q;
    if (b.dataset.opt != null && !this.answered) this.finish(+b.dataset.opt === q.correcta, q.opciones[+b.dataset.opt]);
    else if (b.dataset.mv) {
      const [k, d] = b.dataset.mv.split(':').map(Number);
      const j = k + d;
      if (j < 0 || j >= this.order.length) return;
      [this.order[k], this.order[j]] = [this.order[j], this.order[k]];
      this.render();
      this.el.querySelector(`[data-mv="${j}:${d}"]:not(:disabled)`)?.focus();
    } else if (b.dataset.q === 'check') this.finish(this.order.join() === q.items.join());
    else if (b.dataset.q === 'restart') this.start();
    else if (b.dataset.review) this.onReview(b.dataset.review);
  }

  render() {
    if (this.done) return this.renderResult();
    const q = this.q, n = this.qs.length;
    let body = '';
    if (q.tipo === 'identificar') {
      body = `<p class="q-hint">${t('q.hint')}</p>`;
    } else if (q.tipo === 'opcion') {
      body = `<div class="q-opts">${q.opciones.map((o, k) => {
        let cls = '';
        if (this.answered) cls = k === q.correcta ? 'right' : (this.feedback.given === o ? 'wrong' : '');
        const mark = cls === 'right' ? `<span class="q-mark" aria-label="${t('q.correcta')}">✓</span>` : cls === 'wrong' ? `<span class="q-mark" aria-label="${t('q.incorrecta')}">✕</span>` : '<span class="q-mark" aria-hidden="true"></span>';
        return `<button type="button" class="q-opt ${cls}" data-opt="${k}" ${this.answered ? 'disabled' : ''}><span>${esc(o)}</span>${mark}</button>`;
      }).join('')}</div>`;
    } else if (q.tipo === 'ordenar') {
      const list = this.answered ? q.items : this.order;
      body = `<ol class="q-order">${list.map((id, k) => `
        <li><span class="nm">${esc(this.byId[id].titulo)}</span>
        <span class="mv">
          <button type="button" class="icon" data-mv="${k}:-1" aria-label="${t('q.subir', { x: esc(this.byId[id].titulo) })}" ${this.answered || k === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="icon" data-mv="${k}:1" aria-label="${t('q.bajar', { x: esc(this.byId[id].titulo) })}" ${this.answered || k === list.length - 1 ? 'disabled' : ''}>↓</button>
        </span></li>`).join('')}</ol>
        <button type="button" class="btn secondary" data-q="check" ${this.answered ? 'disabled' : ''}>${t('q.check')}</button>`;
    }

    let fb = '';
    if (this.answered) {
      const f = this.feedback;
      const extra = q.tipo === 'identificar' && !f.ok
        ? `<p>${t('q.tocaste', { a: esc(f.given || t('q.otra')), b: esc(this.byId[q.respuesta].titulo) })}</p>` : '';
      fb = `<div class="q-fb ${f.ok ? 'ok' : 'bad'}" role="status">
        <p class="q-fb-t">${f.ok ? t('q.ok') : t('q.bad')}</p>${extra}<p>${esc(q.explicacion)}</p></div>`;
    }

    this.el.innerHTML = `
      <p class="eyebrow">${t('q.eyebrow', { n: this.i + 1, total: n })}</p>
      <h2 tabindex="-1">${esc(q.pregunta)}</h2>
      ${body}${fb}`;
    this.onChange?.();
  }

  renderResult() {
    const n = this.qs.length;
    const pct = Math.round((this.score / n) * 100);
    const msg = pct >= 85 ? t('q.msg.alto') : pct >= 60 ? t('q.msg.medio') : t('q.msg.bajo');
    const ids = [...new Set(this.missed.map((q) => q.respuesta || q.parte).filter(Boolean))];
    this.onShow(null);
    this.el.innerHTML = `
      <p class="eyebrow">${t('q.result')}</p>
      <h2 tabindex="-1"><span class="score">${this.score}/${n}</span> ${t('q.correctas')}</h2>
      <p class="resumen">${msg}</p>
      ${ids.length ? `<div class="review"><p class="eyebrow">${t('q.repasar')}</p>
        ${ids.map((id) => `<button type="button" class="btn secondary" data-review="${id}">${esc(this.byId[id].titulo)}</button>`).join('')}</div>` : ''}
      <button type="button" class="btn secondary" data-q="restart">${t('q.repetir')}</button>
      <div id="cert-slot"></div>`;
    this.el.querySelector('h2')?.focus();
    this.onChange?.();
  }
}
