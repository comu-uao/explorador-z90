# Plantilla para un equipo nuevo

El Explorador funciona igual para cualquier equipo del CPMA (otra cámara, luces, micrófonos, grabadoras).
Todo lo propio de un equipo vive en su carpeta dentro de `src/equipos/`. El código no cambia.

## Pasos

1. Copia esta carpeta y renómbrala, por ejemplo `src/equipos/fx3/`.
2. Llena los archivos:

| Archivo | Qué lleva |
|---|---|
| `partes.json` | Piezas del modelo 3D: `id`, nombre del objeto en el GLB (`mesh`) y dirección de separación (`explode`). |
| `es/recorrido.json` | Las fichas del recorrido: qué es, para qué sirve, tip, foto y minuto del video. |
| `es/uso.json` | Los pasos de la práctica: qué botón tocar, cómo se mueve y qué cambia en la pantalla simulada. |
| `es/quiz.json` | El banco de preguntas de la evaluación. Cada pregunta lleva un `id` único y un `tipo` (`identificar`, `opcion` u `ordenar`). En `opcion`, `correcta` es la posición de la respuesta buena (la página mezcla el orden). Cada intento saca preguntas al azar: entre más preguntas, más variedad. |
| `es/lab.json` | Retos de exposición, menú simulado, casos de «¿Qué salió mal?» y la lista antes de grabar. Si un equipo no tiene menú (una luz, por ejemplo), deja esas listas vacías. |
| `en/*.json` | Solo los textos traducidos, por `id`. Si falta una traducción, se muestra el español. |
| `fotos/`, `lab/` | Fotos de referencia y escenas del laboratorio. |
| `placeholder.js` | Modelo provisional de bloques, mientras se modela en Blender. |
| `index.js` | Ficha del equipo: nombre, rutas del modelo y del video. |

3. Registra el equipo en `src/equipos/index.js`.

Para empezar rápido, copia los archivos de `z90v/` y reemplaza su contenido: así tienes la estructura exacta de cada campo.
