// Reproductor del video tutorial: abre en el minuto de cada paso y se detiene al terminar esa parte,
// con subtítulos en el idioma elegido.
const aSeg = (m) => { if (!m) return 0; const [a, b] = m.split(':').map(Number); return a * 60 + b; };

export function crearVideo({ equipo, t, getLang }) {
  const dlg = document.querySelector('#dlg-video');
  const v = dlg.querySelector('video');
  const pie = dlg.querySelector('.video-pie');
  let listo = false;

  function preparar() {
    if (listo) return;
    v.src = equipo.video.archivo;
    for (const [l, sub] of Object.entries(equipo.video.subtitulos || {})) {
      // Acepta el texto WebVTT directamente o la ruta de un archivo .vtt
      const src = sub.trimStart().startsWith('WEBVTT') ? URL.createObjectURL(new Blob([sub], { type: 'text/vtt' })) : sub;
      const tr = document.createElement('track');
      Object.assign(tr, { kind: 'subtitles', srclang: l, src, label: l === 'es' ? 'Español' : 'English' });
      tr.addEventListener('load', () => subtitulos());
      v.appendChild(tr);
    }
    listo = true;
  }
  // El navegador puede activar por su cuenta los subtítulos del idioma del sistema: se corrige al cargar cada pista.
  function subtitulos() {
    v.querySelectorAll('track').forEach((tr) => { tr.default = tr.srclang === getLang(); });
    for (const tt of v.textTracks) tt.mode = tt.language === getLang() ? 'showing' : 'disabled';
  }

  // Tramo de cada paso: al llegar al final se pausa, avisa y se cierra la ventana.
  // Si el estudiante adelanta el video a mano más allá del tramo, se respeta y sigue normal.
  let fin = null, saltoPropio = false, cierre = null, vigilando = 0;
  function terminar() {
    fin = null;
    v.pause();
    pie.textContent = t('video.fin');
    pie.classList.add('fin');
    cierre = setTimeout(() => dlg.close(), 1400);
  }
  function vigilar() {
    cancelAnimationFrame(vigilando);
    const paso = () => {
      if (fin == null || v.paused) return;
      if (v.currentTime >= fin) return terminar();
      vigilando = requestAnimationFrame(paso);
    };
    vigilando = requestAnimationFrame(paso);
  }
  v.addEventListener('play', vigilar);
  v.addEventListener('seeking', () => {
    if (saltoPropio) { saltoPropio = false; return; }
    if (fin != null && v.currentTime >= fin) fin = null;   // adelantó a propósito: se deja ver
  });

  dlg.addEventListener('close', () => {
    v.pause(); fin = null; clearTimeout(cierre); cancelAnimationFrame(vigilando);
    pie.classList.remove('fin');
  });
  v.addEventListener('error', () => { pie.textContent = t('video.error'); });
  return {
    disponible: !!equipo.video.archivo,
    abrir(min, titulo, hasta) {
      preparar();
      clearTimeout(cierre);
      pie.classList.remove('fin');
      const desde = aSeg(min);
      fin = hasta ? aSeg(hasta) : null;
      const tramo = hasta ? t('video.tramo', { a: min || '00:00', b: hasta }) : t('video.desde', { min: min || '00:00' });
      pie.textContent = `${equipo.video.fuente} · ${tramo}${titulo ? ' · ' + titulo : ''}`;
      dlg.showModal();
      subtitulos();
      const ir = () => { subtitulos(); saltoPropio = true; v.currentTime = desde; v.play().catch(() => {}); };
      if (v.readyState >= 1) ir();
      else { v.addEventListener('loadedmetadata', ir, { once: true }); v.preload = 'auto'; v.load(); }   // con preload=none el navegador no carga hasta que se pide
    },
    idioma: subtitulos,
  };
}
