// Laboratorio «¿Qué salió mal?»: tomas con un error típico; el estudiante diagnostica la causa.
import { cargar, procesar } from './imagen.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function crearErrores({ t, imagenes, stats, onCambio, titulo }) {
  let casos = [];
  let i = 0;
  const resp = {};            // id del caso → opción elegida en esta sesión
  let pane, cv, audio;
  let n = 0;

  async function dibujar() {
    if (!cv) return;
    const k = ++n;
    const c = casos[i];
    const base = await cargar(imagenes[c.imagen]);
    if (k !== n) return;
    const e = c.efecto || {};
    const img = procesar(base, { gain: 2 ** (e.exp || 0), wb: e.wb || 0, ruido: e.ruido || 0, blur: e.blur || 0, temblor: e.temblor || 0 });
    cv.width = img.width; cv.height = img.height;
    cv.getContext('2d').putImageData(img, 0, 0);
    audio.hidden = !c.audio;
    audio.querySelector('p').textContent = c.audio || '';
  }

  return {
    id: 'err',
    setDatos(d) { casos = d; if (pane) dibujar(); },
    montar(el) {
      pane = el;
      pane.innerHTML = `
        <div class="lcd">
          <canvas class="lcd-img" width="640" height="360" role="img" aria-label="${t('err.imagen')}"></canvas>
          <div class="err-audio" hidden><span class="onda" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><p></p></div>
        </div>
        <p class="lab-cap">${t('err.cap')}</p>`;
      cv = pane.querySelector('.lcd-img');
      audio = pane.querySelector('.err-audio');
    },
    mostrar() { dibujar(); },
    total: () => casos.length,
    actual: () => i,
    hecho: (k) => resp[casos[k].id] != null,
    limpiar() { i = 0; for (const k of Object.keys(resp)) delete resp[k]; },
    ir(k) { i = Math.max(0, Math.min(casos.length - 1, k)); onCambio({ rerender: true }); },
    panelHTML() {
      const c = casos[i];
      const r = resp[c.id];
      const respondida = r != null;
      return `
        <p class="eyebrow">${t('lab.err.eyebrow', { n: i + 1, total: casos.length })}</p>
        <h2 tabindex="-1">${esc(c.pregunta)}</h2>
        <div class="q-opts">${c.opciones.map((o, k) => {
          let cls = '', mark = '';
          if (respondida) { if (k === c.correcta) { cls = 'right'; mark = '✓'; } else if (k === r) { cls = 'wrong'; mark = '✕'; } }
          return `<button type="button" class="q-opt ${cls}" data-op="${k}" ${respondida ? 'disabled' : ''}><span>${esc(o)}</span><span class="q-mark" aria-hidden="true">${mark}</span></button>`;
        }).join('')}</div>
        ${respondida ? `
          <div class="q-fb ${r === c.correcta ? 'ok' : 'bad'}" role="status">
            <p class="q-fb-t">${r === c.correcta ? t('q.ok') : t('q.bad')}</p><p>${esc(c.explicacion)}</p>
          </div>
          ${c.repasar ? `<button type="button" class="btn secondary" data-repasar="${c.repasar}">${t('err.repasar', { parte: esc(titulo(c.repasar)) })}</button>` : ''}` : ''}`;
    },
    enlazar(el) {
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-op]');
        if (!b) return;
        const c = casos[i];
        resp[c.id] = +b.dataset.op;
        onCambio({ rerender: true });
      });
    },
  };
}
