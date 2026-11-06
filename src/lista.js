// Lista «Antes de salir a grabar»: se marca en el celular y se recuerda en este navegador.
import { qrSVG } from './qr.js';

const KEY = 'z90-lista';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function crearLista({ t, urlPublica }) {
  const dlg = document.querySelector('#dlg-lista');
  const cuerpo = dlg.querySelector('.lista-cuerpo');
  let items = [];
  let marcados = new Set((() => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } })());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...marcados])); } catch { /* sin almacenamiento */ } };

  function render() {
    const grupos = [...new Set(items.map((i) => i.grupo))];
    const hechos = items.filter((i) => marcados.has(i.id)).length;
    cuerpo.innerHTML = `
      <div class="lista-prog" role="status">
        <span><b>${hechos}</b> ${t('lista.de', { total: items.length })}</span>
        <div class="bar" aria-hidden="true"><span style="width:${items.length ? (hechos / items.length) * 100 : 0}%"></span></div>
      </div>
      ${grupos.map((g) => `
        <fieldset class="lista-grupo"><legend>${esc(g)}</legend>
          ${items.filter((i) => i.grupo === g).map((i) => `
            <label class="check"><input type="checkbox" data-id="${i.id}" ${marcados.has(i.id) ? 'checked' : ''}><span class="box" aria-hidden="true"></span><span>${esc(i.texto)}</span></label>`).join('')}
        </fieldset>`).join('')}
      <div class="lista-acciones">
        <button type="button" class="btn secondary" data-lista="reset">${t('lista.reiniciar')}</button>
      </div>
      <div class="lista-qr">
        <div class="qr" aria-hidden="true">${qrSVG(urlPublica + '#lista')}</div>
        <div><p class="eyebrow">${t('lista.qr.titulo')}</p><p>${t('lista.qr.texto')}</p><p class="url">${esc(urlPublica)}#lista</p></div>
      </div>`;
  }
  cuerpo.addEventListener('change', (e) => {
    const c = e.target.closest('input[data-id]');
    if (!c) return;
    c.checked ? marcados.add(c.dataset.id) : marcados.delete(c.dataset.id);
    save();
    const foco = c.dataset.id;
    render();
    cuerpo.querySelector(`input[data-id="${foco}"]`)?.focus();
  });
  cuerpo.addEventListener('click', (e) => {
    if (e.target.closest('[data-lista="reset"]')) { marcados.clear(); save(); render(); }
  });
  return {
    setItems(lista) { items = lista; if (dlg.open) render(); },
    abrir() { render(); dlg.showModal(); },
    refrescar() { if (dlg.open) render(); },
  };
}
