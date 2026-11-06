// Reproductor del video tutorial: abre en el minuto de cada paso, con subtítulos en el idioma elegido.
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

  dlg.addEventListener('close', () => v.pause());
  v.addEventListener('error', () => { pie.textContent = t('video.error'); });
  return {
    disponible: !!equipo.video.archivo,
    abrir(min, titulo) {
      preparar();
      pie.textContent = `${equipo.video.fuente} · ${t('video.desde', { min: min || '00:00' })}${titulo ? ' · ' + titulo : ''}`;
      dlg.showModal();
      subtitulos();
      const ir = () => { subtitulos(); v.currentTime = aSeg(min); v.play().catch(() => {}); };
      if (v.readyState >= 1) ir(); else v.addEventListener('loadedmetadata', ir, { once: true });
    },
    idioma: subtitulos,
  };
}
