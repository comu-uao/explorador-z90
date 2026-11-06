// Registro de resultados en este navegador (para el progreso, el certificado y el panel docente).
// Para reunir los datos de todo un curso se necesita un servicio externo: ver DESPLIEGUE.md.
const KEY = 'z90-stats';
const vacio = () => ({ quiz: {}, intentos: 0, mejor: 0, errores: {}, retos: {}, misiones: {} });
let s = (() => { try { return { ...vacio(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return vacio(); } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ } };

export const stats = {
  respuesta(i, ok) { const q = (s.quiz[i] ??= { n: 0, ok: 0 }); q.n++; if (ok) q.ok++; save(); },
  quizTerminado(score, total) { s.intentos++; s.mejor = Math.max(s.mejor, score / total); save(); },
  error(id, ok) { const e = (s.errores[id] ??= { n: 0, ok: 0 }); e.n++; if (ok) e.ok++; save(); },
  reto(id) { s.retos[id] = true; save(); },
  mision(id) { s.misiones[id] = true; save(); },
  datos: () => s,
  reiniciar() { s = vacio(); save(); },
};
