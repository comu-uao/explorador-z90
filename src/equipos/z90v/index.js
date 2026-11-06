// Equipo: Sony PXW-Z90V
// Todo lo propio de esta cámara vive en esta carpeta. Para agregar otro equipo, copia _plantilla/.
import partes from './partes.json';
import recorrido from './es/recorrido.json';
import uso from './es/uso.json';
import quiz from './es/quiz.json';
import lab from './es/lab.json';
import enRecorrido from './en/recorrido.json';
import enUso from './en/uso.json';
import enQuiz from './en/quiz.json';
import enLab from './en/lab.json';
import { buildPlaceholder } from './placeholder.js';
import subEs from './subtitulos/es.vtt?raw';
import subEn from './subtitulos/en.vtt?raw';

const porNombre = (glob) => Object.fromEntries(Object.entries(glob).map(([k, v]) => [k.split('/').pop().replace(/\.\w+$/, ''), v]));

export default {
  id: 'z90v',
  nombre: 'Sony PXW-Z90V',
  corto: 'Z90V',
  partes,
  placeholder: buildPlaceholder,
  modelo: 'models/z90.glb',
  modeloAR: 'models/z90-ar.glb',   // versión a escala real (metros) para realidad aumentada
  tamanoReal: 0.36,                 // largo real aproximado de la cámara, en metros
  video: {
    archivo: 'video/tutorial-z90.mp4',
    youtube: '',                    // si el CPMA lo sube a YouTube, pon aquí el ID del video
    subtitulos: { es: subEs, en: subEn },  // texto WebVTT incluido en el código (sin archivos sueltos)
    fuente: 'Tutorial CPMA · Universidad Autónoma de Occidente',
  },
  fotos: porNombre(import.meta.glob('./fotos/*.jpg', { eager: true, import: 'default' })),
  imagenes: porNombre(import.meta.glob('./lab/*.jpg', { eager: true, import: 'default' })),
  contenido: { recorrido, uso, quiz, lab },
  traducciones: { en: { recorrido: enRecorrido, uso: enUso, quiz: enQuiz, lab: enLab } },
};
