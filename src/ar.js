// Realidad aumentada: muestra la cámara a tamaño real sobre una mesa, desde el celular.
// Usa <model-viewer> de Google, incluido en el proyecto (no depende de servidores externos).
import { qrSVG } from './qr.js';

// Se descarga solo al abrir esta ventana (archivo aparte) y comparte Three.js con el visor.
let carga;
const cargarMV = () => (carga ??= import('@google/model-viewer/dist/model-viewer-module.min.js')
  .then(() => customElements.whenDefined('model-viewer'))
  .catch((e) => { carga = null; throw e; }));

async function existe(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok && !(r.headers.get('content-type') || '').includes('text/html');
  } catch { return false; }
}

export function crearAR({ viewer, equipo, t, urlPublica }) {
  const dlg = document.querySelector('#dlg-ar');
  const zona = dlg.querySelector('.ar-zona');
  const info = dlg.querySelector('.ar-info');
  let blobUrl = null;

  async function fuente() {
    if (viewer.modeloFinal && await existe(equipo.modelo)) return { src: equipo.modelo, escalaReal: false };
    if (await existe(equipo.modeloAR)) return { src: equipo.modeloAR, escalaReal: true };
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = URL.createObjectURL(await viewer.exportarGLB(equipo.tamanoReal));
    return { src: blobUrl, escalaReal: true };
  }

  function infoSinAR() {
    info.innerHTML = `
      <div class="ar-qr"><div class="qr" aria-hidden="true">${qrSVG(urlPublica + '#ar')}</div>
      <div><p class="eyebrow">${t('ar.celular.titulo')}</p><p>${t('ar.celular.texto')}</p><p class="url">${urlPublica}#ar</p></div></div>`;
  }

  dlg.addEventListener('close', () => { viewer.dirty = true; });

  return {
    async abrir() {
      dlg.showModal();
      zona.innerHTML = `<p class="ar-cargando">${t('ar.cargando')}</p>`;
      info.innerHTML = '';
      try {
        const [{ src }] = await Promise.all([fuente(), cargarMV()]);
        zona.innerHTML = `
          <model-viewer src="${src}" ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" ar-placement="floor"
            camera-controls touch-action="pan-y" auto-rotate shadow-intensity="1" exposure="1.1" alt="${t('ar.alt', { equipo: equipo.nombre })}">
            <button slot="ar-button" class="btn primary ar-btn">${t('ar.boton')}</button>
          </model-viewer>`;
        const mv = zona.querySelector('model-viewer');
        mv.addEventListener('load', () => {
          if (mv.canActivateAR) info.innerHTML = `<p>${t('ar.instrucciones')}</p>`;
          else infoSinAR();
        }, { once: true });
        mv.addEventListener('ar-status', (e) => {
          if (e.detail.status === 'failed') info.innerHTML = `<p class="warn-line">${t('ar.fallo')}</p>`;
        });
      } catch {
        zona.innerHTML = `<p class="warn-line">${t('ar.error')}</p>`;
        infoSinAR();
      }
    },
  };
}
