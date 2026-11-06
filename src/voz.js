// Narración en voz alta con la voz del navegador (Web Speech API): no necesita archivos de audio.
export const vozDisponible = typeof window !== 'undefined' && 'speechSynthesis' in window;
let actual = null;

export function hablar(texto, lang, alTerminar) {
  if (!vozDisponible) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = lang === 'en' ? 'en-US' : 'es-CO';
  const voces = speechSynthesis.getVoices();
  u.voice = voces.find((v) => v.lang.toLowerCase() === u.lang.toLowerCase()) || voces.find((v) => v.lang.toLowerCase().startsWith(lang)) || null;
  u.rate = 1;
  u.onend = u.onerror = () => { if (actual === u) actual = null; alTerminar?.(); };
  actual = u;
  speechSynthesis.speak(u);
}

export function callar() { if (vozDisponible) speechSynthesis.cancel(); actual = null; }
export const hablando = () => !!actual;
