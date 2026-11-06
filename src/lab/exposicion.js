// Laboratorio de exposición: iris, ISO, obturador, ND y balance de blancos sobre una foto real,
// con cebra, histograma y medidor de exposición como en la pantalla de la cámara.
import { cargar, procesar, histograma, dibujarHist } from './imagen.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function crearExposicion({ t, imagenes, stats, onCambio }) {
  let D = null;           // datos de exposición (listas y retos)
  let i = 0;              // reto actual
  let st = null;          // ajustes actuales
  let superado = false;
  let pista = false;
  let pane, cv, hcv, hud, aguja;
  let dibujando = 0;

  const reto = () => D.retos[i];
  const ev = (s) => Math.log2(s.f * s.f * s.obt) - Math.log2(s.iso / 100) + D.nd[s.nd].pasos;
  const delta = () => reto().ev - ev(st);

  function reiniciar() {
    const r = reto();
    st = { ...r.inicio, nd: D.nd.findIndex((n) => n.pasos === r.inicio.nd), cebra: st?.cebra ?? false, hist: st?.hist ?? true };
    if (st.nd < 0) st.nd = 0;
    superado = !!stats.datos().retos[r.id];
    pista = false;
  }

  function evaluar() {
    const r = reto(), dlt = delta();
    return r.metas.map((m) => {
      let ok = false;
      if (m.tipo === 'exp') ok = Math.abs(dlt) <= 0.5;
      else if (m.tipo === 'fmax') ok = st.f <= m.valor;
      else if (m.tipo === 'fmin') ok = st.f >= m.valor;
      else if (m.tipo === 'obt') ok = m.valores.includes(st.obt);
      else if (m.tipo === 'isomax') ok = st.iso <= m.valor;
      else if (m.tipo === 'ndmax') ok = D.nd[st.nd].pasos <= m.valor;
      else if (m.tipo === 'wb') ok = st.wb === r.luzK;
      return { ...m, ok };
    });
  }

  async function dibujar() {
    if (!cv) return;
    const n = ++dibujando;
    const r = reto();
    const base = await cargar(imagenes[r.imagen]);
    if (n !== dibujando) return;
    const pasosWB = (Math.log2(st.wb / r.luzK) / Math.log2(5600 / 3200)) * 1.3;
    const ruido = Math.max(0, Math.log2(st.iso / 320)) * 0.02;
    const img = procesar(base, { gain: 2 ** clamp(delta(), -7, 7), wb: pasosWB, ruido, cebra: st.cebra });
    cv.width = img.width; cv.height = img.height;
    cv.getContext('2d').putImageData(img, 0, 0);
    hcv.hidden = !st.hist;
    if (st.hist) dibujarHist(hcv, histograma(img));
  }

  function actualizarHud() {
    if (!hud) return;
    const dlt = delta();
    hud.querySelector('.h-nd').textContent = `ND ${D.nd[st.nd].nombre}`;
    hud.querySelector('.h-f').textContent = `F${st.f.toFixed(1)}`;
    hud.querySelector('.h-iso').textContent = `ISO${st.iso}`;
    hud.querySelector('.h-obt').textContent = `1/${st.obt}`;
    hud.querySelector('.h-wb').textContent = `${st.wb}K`;
    aguja.style.left = `${100 / 14 + ((clamp(dlt, -3.4, 3.4) + 3) / 6) * (600 / 7)}%`;
    aguja.classList.toggle('ok', Math.abs(dlt) <= 0.5);
    pane.querySelector('.lcd-meter').setAttribute('aria-label', t('exp.medidor', { v: (dlt > 0 ? '+' : '') + dlt.toFixed(1) }));
  }

  function actualizarPanel(body) {
    const res = evaluar();
    const todo = res.every((m) => m.ok);
    body.querySelector('#x-metas').innerHTML = res.map((m) => `<li class="${m.ok ? 'ok' : ''}"><span class="meta-ico" aria-hidden="true">${m.ok ? '✓' : '•'}</span><span>${esc(m.texto)}</span></li>`).join('');
    const dlt = delta();
    const estado = body.querySelector('#x-estado');
    if (todo) {
      if (!superado) { superado = true; stats.reto(reto().id); onCambio({ rerender: false }); }
      estado.className = 'status ok';
      estado.innerHTML = `<span class="status-mark" aria-hidden="true">✓</span><p>${t('exp.superado')}</p>`;
    } else {
      const msg = Math.abs(dlt) <= 0.5 ? t('exp.casi') : dlt > 0 ? t('exp.sobre', { v: dlt.toFixed(1) }) : t('exp.sub', { v: (-dlt).toFixed(1) });
      estado.className = `status ${pista ? 'warn' : 'info'}`;
      estado.innerHTML = `<span class="status-mark" aria-hidden="true">${pista ? '!' : ''}</span><p>${pista ? esc(reto().pista) : msg}</p>`;
    }
    body.querySelector('#x-f-out').textContent = `f/${st.f}`;
    body.querySelector('#x-iso-out').textContent = st.iso;
    body.querySelector('#x-obt-out').textContent = `1/${st.obt}`;
    body.querySelectorAll('[data-nd]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.nd === st.nd)));
    body.querySelectorAll('[data-wb]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.wb === st.wb)));
  }

  return {
    id: 'exp',
    setDatos(d) { const prev = D; D = d; if (!prev || !st) reiniciar(); },
    montar(el) {
      pane = el;
      pane.innerHTML = `
        <div class="lcd">
          <canvas class="lcd-img" width="640" height="360" role="img" aria-label="${t('exp.imagen')}"></canvas>
          <canvas class="lcd-hist" width="132" height="60" aria-hidden="true"></canvas>
          <div class="lcd-hud" aria-hidden="true"><span class="h-nd"></span><span class="h-f"></span><span class="h-iso"></span><span class="h-obt"></span><span class="h-wb"></span></div>
          <div class="lcd-meter" role="img"><span>−3</span><span>−2</span><span>−1</span><span>0</span><span>+1</span><span>+2</span><span>+3</span><i class="aguja"></i></div>
        </div>
        <p class="lab-cap">${t('exp.cap')}</p>`;
      cv = pane.querySelector('.lcd-img');
      hcv = pane.querySelector('.lcd-hist');
      hud = pane.querySelector('.lcd-hud');
      aguja = pane.querySelector('.aguja');
    },
    mostrar() { actualizarHud(); dibujar(); },
    total: () => D.retos.length,
    actual: () => i,
    hecho: (k) => !!stats.datos().retos[D.retos[k].id],
    ir(k) { i = clamp(k, 0, D.retos.length - 1); reiniciar(); onCambio({ rerender: true }); },
    panelHTML() {
      const r = reto();
      const rango = (id, lista, val) => `<input type="range" id="x-${id}" min="0" max="${lista.length - 1}" step="1" value="${Math.max(0, lista.indexOf(val))}">`;
      return `
        <p class="eyebrow">${t('lab.exp.eyebrow', { n: i + 1, total: D.retos.length })}</p>
        <h2 tabindex="-1">${esc(r.titulo)}</h2>
        <p class="resumen">${esc(r.desc)}</p>
        <div class="ctrls">
          <div class="ctrl"><label for="x-f">${t('exp.iris')}</label>${rango('f', D.iris, st.f)}<output id="x-f-out" for="x-f"></output></div>
          <div class="ctrl"><label for="x-iso">ISO</label>${rango('iso', D.iso, st.iso)}<output id="x-iso-out" for="x-iso"></output></div>
          <div class="ctrl"><label for="x-obt">${t('exp.obt')}</label>${rango('obt', D.obturador, st.obt)}<output id="x-obt-out" for="x-obt"></output></div>
          <div class="ctrl"><span class="ctrl-l">${t('exp.nd')}</span><div class="seg-group" role="group" aria-label="${t('exp.nd')}">${D.nd.map((n, k) => `<button type="button" data-nd="${k}">${n.nombre}</button>`).join('')}</div></div>
          <div class="ctrl"><span class="ctrl-l">${t('exp.wb')}</span><div class="seg-group" role="group" aria-label="${t('exp.wb')}">${D.wb.map((k) => `<button type="button" data-wb="${k}">${k}K</button>`).join('')}</div></div>
          <div class="toggles">
            <label class="switch"><input type="checkbox" id="x-cebra" ${st.cebra ? 'checked' : ''}><span aria-hidden="true"></span>${t('exp.cebra')}</label>
            <label class="switch"><input type="checkbox" id="x-hist" ${st.hist ? 'checked' : ''}><span aria-hidden="true"></span>${t('exp.hist')}</label>
          </div>
        </div>
        <ul class="metas" id="x-metas" aria-live="polite"></ul>
        <div class="status info" id="x-estado" role="status"></div>
        <div class="lab-acciones">
          <button type="button" class="btn secondary" data-x="pista">${t('lab.pista')}</button>
          <button type="button" class="btn secondary" data-x="reset">${t('lab.reiniciar')}</button>
        </div>`;
    },
    enlazar(body) {
      const set = (k, v) => { st[k] = v; actualizarPanel(body); actualizarHud(); dibujar(); };
      body.querySelector('#x-f').addEventListener('input', (e) => set('f', D.iris[+e.target.value]));
      body.querySelector('#x-iso').addEventListener('input', (e) => set('iso', D.iso[+e.target.value]));
      body.querySelector('#x-obt').addEventListener('input', (e) => set('obt', D.obturador[+e.target.value]));
      body.querySelector('#x-cebra').addEventListener('change', (e) => set('cebra', e.target.checked));
      body.querySelector('#x-hist').addEventListener('change', (e) => set('hist', e.target.checked));
      body.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.nd != null) set('nd', +b.dataset.nd);
        else if (b.dataset.wb != null) set('wb', +b.dataset.wb);
        else if (b.dataset.x === 'pista') { pista = true; actualizarPanel(body); }
        else if (b.dataset.x === 'reset') { reiniciar(); onCambio({ rerender: true }); }
      });
      actualizarPanel(body);
    },
  };
}
