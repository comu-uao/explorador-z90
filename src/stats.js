// Avance del estudiante en esta visita (solo en memoria): mejor nota de la evaluación,
// retos de exposición y misiones del menú superados. Se borra al recargar o al volver a comenzar.
const vacio = () => ({ mejor: 0, retos: {}, misiones: {} });
let ses = vacio();
// Limpia los datos que guardaba la versión con panel docente
try { localStorage.removeItem('z90-stats'); } catch { /* sin almacenamiento */ }

export const stats = {
  quizTerminado(score, total) { ses.mejor = Math.max(ses.mejor, score / total); },
  reto(id) { ses.retos[id] = true; },
  mision(id) { ses.misiones[id] = true; },
  sesion: () => ses,
  nuevaSesion() { ses = vacio(); },
};
