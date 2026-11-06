// Laboratorio de menú: réplica navegable del menú de la Z90V con la palanca de mando (o el teclado).
import { cargar, procesar, bordes } from './imagen.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLORES = [[255, 255, 255], [255, 40, 60], [255, 220, 40]];
const ICONOS = {
  cam: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  grab: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  audio: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  pant: '<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M9 21h6M12 17v4"/>',
};

export function crearMenu({ t, imagenes, stats, onCambio }) {
  let arbol = [], misiones = [];
  let valores = {};          // id del ajuste → índice de la opción elegida
  let m = 0;                 // misión actual
  let abierto = false;
  let pila = [];             // niveles abiertos: { nodo, sel }
  let opc = null;            // índice de opción mientras se elige un valor
  let pista = false;
  let recienHecha = null;
  let pane, cv, lista, hud, base = null, puntos = null, panelEl = null;

  const nodos = (n, out = []) => { n.forEach((x) => { out.push(x); if (x.items) nodos(x.items, out); }); return out; };
  const nodo = (id) => nodos(arbol).find((x) => x.id === id);
  const hecha = (mi) => valores[mi.item] === mi.valor;

  function initValores() { nodos(arbol).forEach((x) => { if (x.opciones && valores[x.id] == null) valores[x.id] = x.valor ?? 0; }); }

  async function dibujarVivo() {
    if (!cv) return;
    base ??= await cargar(imagenes.jardin);
    puntos ??= bordes(base, 0.05);
    const img = procesar(base, {
      cebra: valores.cebra === 1,
      peaking: valores.atenon === 1 ? { puntos, color: COLORES[valores.atencol ?? 1] } : null,
    });
    cv.width = img.width; cv.height = img.height;
    cv.getContext('2d').putImageData(img, 0, 0);
    const op = (id) => nodo(id)?.opciones?.[valores[id]] ?? '';
    hud.innerHTML = `
      <span class="hud-l">${esc(op('fmt'))}${valores.simul ? ' · ' + esc(op('simul')) : ''}</span>
      <span class="hud-r">${valores.steady !== 2 ? '◈ ' + esc(op('steady')) : ''}</span>
      <span class="hud-b">MIC: ${esc(op('mic'))}${valores.atenon === 1 ? ' · PEAKING' : ''}${valores.cebra === 1 ? ' · ' + esc(nodo('cebra').nombre) : ''}</span>`;
  }

  function dibujarMenu() {
    if (!lista) return;
    lista.hidden = !abierto;
    hud.hidden = abierto;
    if (!abierto) return;
    const nivel = pila[pila.length - 1];
    const items = nivel.nodo.items;
    const cat = pila[1]?.nodo || (pila.length === 1 ? items[nivel.sel] : null);
    lista.innerHTML = `
      <div class="ml-iconos">${arbol.map((c) => `<span class="${cat?.id === c.id ? 'on' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[c.icono] || ''}</svg></span>`).join('')}</div>
      <div class="ml-lista">
        <p class="ml-titulo">${esc(pila.length === 1 ? t('lab.menu.raiz') : nivel.nodo.nombre)}</p>
        <ol>${items.map((x, k) => `
          <li class="${k === nivel.sel ? 'sel' : ''}"><span>${esc(x.nombre)}</span><span class="val">${x.opciones ? esc(x.opciones[valores[x.id]]) : '▶'}</span></li>`).join('')}</ol>
        <p class="ml-pie">[MENU]: ${t('lab.menu.fin')}</p>
      </div>
      ${opc != null ? `<div class="ml-opciones"><p class="ml-titulo">${esc(items[nivel.sel].nombre)}</p><ol>${items[nivel.sel].opciones.map((o, k) => `<li class="${k === opc ? 'sel' : ''}">${esc(o)}</li>`).join('')}</ol></div>` : ''}`;
  }

  function confirmar(item) {
    valores[item.id] = opc;
    opc = null;
    recienHecha = null;
    misiones.forEach((mi) => { if (hecha(mi) && !stats.sesion().misiones[mi.id]) { stats.mision(mi.id); if (mi === misiones[m]) recienHecha = mi.id; } });
    dibujarVivo();
    if (panelEl) actualizarPanel(panelEl);
    onCambio({ rerender: false });
  }

  function tecla(k) {
    if (k === 'menu') { abierto = !abierto; pila = abierto ? [{ nodo: { items: arbol }, sel: 0 }] : []; opc = null; dibujarMenu(); return; }
    if (!abierto) { if (k === 'ok') { abierto = true; pila = [{ nodo: { items: arbol }, sel: 0 }]; dibujarMenu(); } return; }
    const nivel = pila[pila.length - 1];
    const items = nivel.nodo.items;
    const item = items[nivel.sel];
    if (opc != null) {
      if (k === 'up') opc = (opc - 1 + item.opciones.length) % item.opciones.length;
      else if (k === 'down') opc = (opc + 1) % item.opciones.length;
      else if (k === 'ok' || k === 'right') { confirmar(item); }
      else if (k === 'left') opc = null;
    } else if (k === 'up') nivel.sel = (nivel.sel - 1 + items.length) % items.length;
    else if (k === 'down') nivel.sel = (nivel.sel + 1) % items.length;
    else if (k === 'ok' || k === 'right') {
      if (item.items) pila.push({ nodo: item, sel: 0 });
      else if (item.opciones) opc = valores[item.id];
    } else if (k === 'left') {
      if (pila.length > 1) pila.pop(); else { abierto = false; pila = []; }
    }
    dibujarMenu();
  }

  function actualizarPanel(el) {
    const mi = misiones[m];
    const ok = hecha(mi);
    const estado = el.querySelector('#ml-estado');
    estado.className = `status ${ok ? 'ok' : pista ? 'warn' : 'info'}`;
    estado.innerHTML = ok
      ? `<span class="status-mark" aria-hidden="true">✓</span><p>${t('lab.menu.hecha')}</p>`
      : `<span class="status-mark" aria-hidden="true">${pista ? '!' : ''}</span><p>${pista ? `${t('lab.menu.ruta')}: <b>${esc(mi.ayuda)}</b>` : t('lab.menu.instr')}</p>`;
    el.querySelector('#ml-lista').innerHTML = misiones.map((x, k) => `
      <li class="${hecha(x) ? 'ok' : ''} ${k === m ? 'actual' : ''}"><button type="button" data-mision="${k}"><span class="meta-ico" aria-hidden="true">${hecha(x) ? '✓' : k + 1}</span><span>${esc(x.texto)}</span></button></li>`).join('');
  }

  return {
    id: 'menu',
    tecla,
    setDatos(d) { arbol = d.arbol; misiones = d.misiones; initValores(); if (abierto) dibujarMenu(); },
    montar(el) {
      pane = el;
      pane.innerHTML = `
        <div class="lcd">
          <canvas class="lcd-img" width="640" height="360" role="img" aria-label="${t('lab.menu.vivo')}"></canvas>
          <div class="ml-hud" aria-hidden="true"></div>
          <div class="ml-menu" hidden aria-live="polite"></div>
        </div>
        <div class="ml-ctrl" role="group" aria-label="${t('lab.menu.controles')}">
          <button type="button" class="ml-menubtn" data-k="menu">MENU</button>
          <div class="dpad">
            <button type="button" class="dp up" data-k="up" aria-label="${t('dpad.arriba')}">▲</button>
            <button type="button" class="dp left" data-k="left" aria-label="${t('dpad.izq')}">◀</button>
            <button type="button" class="dp ok" data-k="ok" aria-label="${t('dpad.ok')}"></button>
            <button type="button" class="dp right" data-k="right" aria-label="${t('dpad.der')}">▶</button>
            <button type="button" class="dp down" data-k="down" aria-label="${t('dpad.abajo')}">▼</button>
          </div>
          <p class="ml-ayuda">${t('lab.menu.teclado')}</p>
        </div>`;
      cv = pane.querySelector('.lcd-img');
      lista = pane.querySelector('.ml-menu');
      hud = pane.querySelector('.ml-hud');
      pane.querySelector('.ml-ctrl').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) tecla(b.dataset.k); });
    },
    mostrar() { dibujarVivo(); dibujarMenu(); },
    total: () => misiones.length,
    actual: () => m,
    hecho: (k) => hecha(misiones[k]),
    ir(k) { m = Math.max(0, Math.min(misiones.length - 1, k)); pista = false; onCambio({ rerender: true }); },
    minuto: () => misiones[m]?.min,
    limpiar() { valores = {}; initValores(); m = 0; abierto = false; pila = []; opc = null; pista = false; recienHecha = null; },
    panelHTML() {
      const mi = misiones[m];
      return `
        <p class="eyebrow">${t('lab.menu.eyebrow', { n: m + 1, total: misiones.length })}</p>
        <h2 tabindex="-1">${esc(mi.texto)}</h2>
        <div class="status info" id="ml-estado" role="status"></div>
        <div class="lab-acciones">
          <button type="button" class="btn secondary" data-ml="pista">${t('lab.pista')}</button>
          <button type="button" class="btn secondary" data-video="${mi.min || ''}" data-hasta="${mi.hasta || ''}" ${mi.min ? '' : 'disabled'}>${t('video.corto')}${mi.min ? ' · ' + mi.min : ''}</button>
        </div>
        <p class="eyebrow">${t('lab.menu.todas')}</p>
        <ol class="misiones" id="ml-lista"></ol>`;
    },
    enlazar(el) {
      panelEl = el;
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.ml === 'pista') { pista = true; actualizarPanel(el); }
        else if (b.dataset.mision != null) this.ir(+b.dataset.mision);
      });
      actualizarPanel(el);
    },
  };
}
