// Idiomas de la interfaz. El contenido de cada equipo se traduce en src/equipos/<equipo>/en/.
import es from './es.js';
import en from './en.js';

const DIC = { es, en };
export const IDIOMAS = ['es', 'en'];
let lang = (() => { try { return localStorage.getItem('z90-lang'); } catch { return null; } })();
if (!IDIOMAS.includes(lang)) lang = 'es';
const oyentes = [];

export const getLang = () => lang;
export const onLang = (f) => oyentes.push(f);

export function t(k, vars = {}) {
  const s = DIC[lang][k] ?? DIC.es[k] ?? k;
  return s.replace(/\{(\w+)\}/g, (_, v) => (vars[v] ?? ''));
}

export function setLang(l) {
  if (!IDIOMAS.includes(l) || l === lang) return;
  lang = l;
  try { localStorage.setItem('z90-lang', l); } catch { /* sin almacenamiento */ }
  aplicar();
  oyentes.forEach((f) => f(l));
}

// Traduce los textos fijos del HTML marcados con data-i18n*
export function aplicar(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  root.querySelectorAll('[data-i18n-tip]').forEach((el) => el.setAttribute('data-tip', t(el.dataset.i18nTip)));
  root.querySelectorAll('[data-i18n-alt]').forEach((el) => el.setAttribute('alt', t(el.dataset.i18nAlt)));
  root.querySelectorAll('[data-i18n-title]').forEach((el) => el.setAttribute('title', t(el.dataset.i18nTitle)));
  root.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}
