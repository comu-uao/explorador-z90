// Constancia de uso: se obtiene al completar recorrido, práctica y evaluación.
// El código es una huella de los datos; la verificación oficial la haría el CPMA con su registro.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY = 'z90-cert';

function huella(txt) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (const ch of txt) { const c = ch.codePointAt(0); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 + c, 2654435761) >>> 0; }
  return (h1.toString(36) + h2.toString(36)).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8).padEnd(8, '0');
}

export function crearCertificado({ t, getLang, equipo, requisitos, minimo }) {
  const dlg = document.querySelector('#dlg-cert');
  const hoja = dlg.querySelector('.cert-hoja');
  const area = document.querySelector('#print-area');
  const guardado = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };

  function bloque() {
    const req = requisitos();
    const ok = req.every((r) => r.ok);
    const prev = guardado();
    return `
      <div class="cert-bloque">
        <p class="eyebrow">${t('cert.titulo')}</p>
        <ul class="metas">${req.map((r) => `<li class="${r.ok ? 'ok' : ''}"><span class="meta-ico" aria-hidden="true">${r.ok ? '✓' : '•'}</span><span>${r.texto}</span></li>`).join('')}</ul>
        ${ok ? `
          <label class="campo" for="cert-nombre">${t('cert.nombre')}</label>
          <input id="cert-nombre" class="input" type="text" autocomplete="name" maxlength="70" value="${esc(prev?.nombre || '')}" placeholder="${t('cert.nombre.ej')}">
          <button type="button" class="btn primary" data-cert="generar">${t('cert.generar')}</button>`
        : `<p class="nota">${t('cert.falta', { min: Math.round(minimo * 100) })}</p>`}
      </div>`;
  }

  function hojaHTML(d) {
    const fecha = new Date(d.fecha).toLocaleDateString(getLang() === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    return `
      <div class="cert">
        <svg class="cert-arco" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 120 C 30 6, 370 6, 400 120"/></svg>
        <p class="cert-kicker">${t('cert.kicker')}</p>
        <h2 class="cert-h">${t('cert.h')}</h2>
        <p class="cert-a">${t('cert.otorga')}</p>
        <p class="cert-nombre">${esc(d.nombre)}</p>
        <p class="cert-txt">${t('cert.texto', { equipo: equipo.nombre })}</p>
        <dl class="cert-datos">
          <div><dt>${t('cert.fecha')}</dt><dd>${fecha}</dd></div>
          <div><dt>${t('cert.puntaje')}</dt><dd>${Math.round(d.puntaje * 100)}%</dd></div>
          <div><dt>${t('cert.codigo')}</dt><dd>${d.codigo}</dd></div>
        </dl>
        <p class="cert-pie">${t('cert.pie')}</p>
      </div>`;
  }

  function generar(nombre, puntaje) {
    const fecha = new Date().toISOString();
    const d = { nombre, puntaje, fecha, codigo: `${equipo.corto}-${huella(`${nombre}|${fecha.slice(0, 10)}|${puntaje}`)}` };
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* sin almacenamiento */ }
    hoja.innerHTML = hojaHTML(d);
    dlg.showModal();
  }

  dlg.addEventListener('click', (e) => {
    if (e.target.closest('[data-cert="imprimir"]')) {
      area.innerHTML = hoja.innerHTML;
      try { window.print(); } catch { /* el marco no permite imprimir */ }
    }
  });

  return { bloque, generar };
}
