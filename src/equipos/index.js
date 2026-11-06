// Registro de equipos y armado del contenido según el idioma.
// El contenido en español es el original y define la estructura; las traducciones solo reemplazan textos.
import z90v from './z90v/index.js';

export const EQUIPOS = { z90v };
export const EQUIPO_ACTUAL = z90v;

const porId = (base, tr) => base.map((x) => ({ ...x, ...(tr?.[x.id] || {}) }));

export function contenido(equipo, lang) {
  const b = equipo.contenido;
  const t = lang === 'es' ? null : equipo.traducciones[lang];
  if (!t) return structuredClone(b);
  const lab = structuredClone(b.lab);
  const tl = t.lab || {};
  lab.exposicion.retos = lab.exposicion.retos.map((r) => {
    const x = tl.retos?.[r.id];
    if (!x) return r;
    return { ...r, titulo: x.titulo, desc: x.desc, pista: x.pista, metas: r.metas.map((m, i) => ({ ...m, texto: x.metas?.[i] ?? m.texto })) };
  });
  const renombrar = (nodos) => nodos.forEach((n) => {
    if (tl.menu?.nombres?.[n.id]) n.nombre = tl.menu.nombres[n.id];
    if (n.opciones && tl.menu?.opciones?.[n.id]) n.opciones = tl.menu.opciones[n.id];
    if (n.items) renombrar(n.items);
  });
  renombrar(lab.menu.arbol);
  lab.menu.misiones = porId(lab.menu.misiones, tl.menu?.misiones);
  lab.errores = porId(lab.errores, tl.errores);
  lab.lista = porId(lab.lista, tl.lista);
  return {
    recorrido: porId(b.recorrido, t.recorrido),
    uso: porId(b.uso, t.uso),
    quiz: b.quiz.map((q, i) => ({ ...q, ...(t.quiz?.[i] || {}) })),
    lab,
  };
}
