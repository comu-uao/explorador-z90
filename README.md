# Explorador 3D Z90V

Página web educativa para conocer la cámara Sony PXW-Z90V en 3D. El contenido sigue el video tutorial del Centro de Producción de Medios Audiovisuales (CPMA) de la Universidad Autónoma de Occidente: cada ficha y cada paso de la práctica muestra una foto del tutorial y el minuto donde se explica. Tiene tres secciones, en orden:

- **Recorrido:** 8 partes explicadas en lenguaje sencillo (qué es, para qué sirve y un tip). Tocar cualquier pieza del modelo lleva a su ficha.
- **Uso de la cámara:** 12 pasos guiados, en el mismo orden del tutorial, para hacer la primera toma. El estudiante presiona cada botón o palanca en el modelo, la pieza se mueve o se hunde y una pantalla simulada muestra el efecto.
- **Evaluación:** 8 preguntas cortas, con resultado y partes para repasar.

Mientras se termina el modelo 3D, el visor muestra un **modelo provisional de bloques**. Sus piezas y botones tienen los mismos nombres que tendrá el modelo final, así que todo funciona desde ya. Cuando el modelo esté listo, basta con copiarlo a `public/models/z90.glb`.

## Cómo ejecutarlo

Se necesita [Node.js](https://nodejs.org) 18 o superior.

```bash
npm install
npm run dev        # abre http://localhost:5173
npm run build      # genera dist/ lista para publicar
```

## Estructura

```
explorador-z90/
├─ index.html              Portada y estructura de la página
├─ public/models/          ← AQUÍ VA EL MODELO: z90.glb
└─ src/
   ├─ config.js            Ruta del modelo, vista inicial, color de resaltado
   ├─ main.js              Modos, ficha, práctica, barra de progreso, teclado
   ├─ viewer.js            Three.js: carga, capas, selección, botones animados, cámara
   ├─ placeholder.js       Modelo provisional de bloques
   ├─ monitor.js           Pantalla simulada de la cámara
   ├─ assets/tutorial/     Fotos tomadas del video tutorial del CPMA
   ├─ quiz.js              Evaluación
   ├─ style.css            Diseño (rojo, crema y verde del curso)
   └─ data/
      ├─ partes.json       Piezas del modelo y hacia dónde se separan
      ├─ recorrido.json    Las 8 fichas del recorrido
      ├─ uso.json          Los 10 pasos de «Uso de la cámara»
      └─ quiz.json         Preguntas de la evaluación
```

Los textos están en `src/data/`. Un profesor puede corregirlos sin tocar el código.

## Diseño

- Paleta del material del curso: rojo carmín `#a8172f`, crema `#fdf3e3`, blanco y verde salvia `#dfe2cb`.
- Portada con el bloque rojo y el marco con arco, como en las diapositivas del curso, y un único botón **Comenzar**.
- Barra superior simétrica: Inicio · secciones 1-2-3 · Ayuda.
- Dentro del visor, abajo al centro, el control **Armada | Por capas** muestra siempre los dos estados y nunca cambia de tamaño. A la derecha: Aislar, Reiniciar vista y Pantalla completa, con su nombre al pasar el cursor.
- Las etiquetas numeradas se ubican alrededor del modelo con una línea guía hacia cada pieza. Un algoritmo evita que se monten entre sí, que tapen los puntos de las piezas o los controles del visor.
- La navegación vive en un solo lugar: el pie de la ficha (**← Anterior | Siguiente →**), con dos botones de igual tamaño que no se mueven. La barra de segmentos de abajo muestra el progreso y permite saltar a un paso.
- La herramienta para probar un .glb está en **Ayuda → Para el equipo de modelado**, fuera de la vista del estudiante.

## Cómo preparar el modelo final en Blender

### 1. Piezas (para las capas y el recorrido)

Cada parte debe ser un objeto, o un *Empty* que agrupe sus mallas, con **exactamente** este nombre:

| Parte | Nombre |
|---|---|
| Parasol | `Parasol` |
| Lente | `Lente_Zeiss` |
| Filtro ND (interno) | `Filtro_ND` |
| Sensor (interno) | `Sensor_CMOS` |
| Cuerpo | `Cuerpo` |
| Pantalla | `Pantalla_LCD` |
| Visor | `Visor_OLED` |
| Asa | `Asa_XLR` |
| Micrófono | `Microfono` |
| Ranuras SD | `Ranuras_SD` |
| Conectores | `Conectores` |
| Batería | `Bateria` |

### 2. Controles (para «Uso de la cámara»)

La ubicación sigue el video tutorial del CPMA (Universidad Autónoma de Occidente) sobre la PXW-Z90V. Los controles van **dentro** de la pieza indicada, y su origen (pivote) debe estar donde la pieza gira o se apoya: la bisagra de la pantalla, el centro del anillo.

| Paso | Control | Nombre | Dentro de | Dónde está en la cámara real |
|---|---|---|---|---|
| 1 | Batería | `Bateria` | (es la pieza) | Atrás, debajo del visor |
| 2 | Pantalla LCD (pivote en la bisagra delantera) | `Pantalla_LCD` | (es la pieza) | Lado izquierdo; al abrirla se enciende la cámara |
| 3 | Tapa de las tarjetas · Tarjeta | `Tapa_SD` · `Tarjeta_SD` | `Ranuras_SD` | Panel lateral, detrás de la pantalla |
| 4 | Botón MENU | `Btn_Menu` | `Cuerpo` | Panel lateral, detrás de la pantalla |
| 5 | Interruptor AUTO/MANUAL | `Interruptor_Auto` | `Cuerpo` | Atrás, lado izquierdo, abajo |
| 6 | Botón IRIS (también `Btn_ISO`, `Btn_Shutter`) | `Btn_Iris` | `Cuerpo` | Fila de abajo, lado izquierdo |
| 7 | Selector ND | `Selector_ND` | `Cuerpo` | Atrás, lado izquierdo, arriba |
| 8 | Botón WHITE BALANCE | `Btn_WB` | `Cuerpo` | Panel lateral, detrás de la pantalla |
| 9 | Palanca de zoom | `Palanca_Zoom` | `Asa_XLR` | Encima del asa |
| 10 | Botón AF/MF · Anillo del lente | `Btn_AF` · `Anillo_Lente` | `Lente_Zeiss` | Costado izquierdo del lente |
| 11 | Interruptores INPUT | `Selector_Audio` | `Asa_XLR` | Junto a las entradas XLR |
| 12 | Botón REC | `Btn_REC` | `Asa_XLR` | Encima del asa (hay otro atrás: `Btn_REC_Trasero`) |

También existen en el modelo provisional, para modelarlos aunque todavía no tienen paso propio: `Btn_Encendido`, `Selector_Anillo` (FOCUS/ZOOM), `Palanca_Mando` (atrás, para moverse por el menú) y `Btn_REC_Trasero`.

Si falta un control, el paso se completa tocando la pieza que lo contiene, sin la animación.

### 3. Orientación, exportación y prueba

- En Blender, el lente apunta hacia **−X**, la parte de arriba hacia **+Z** y el lado izquierdo del operador (el de la pantalla) hacia **−Y**. Así coinciden las direcciones de `partes.json` y `uso.json`.
- La escala no importa: la página ajusta el tamaño y centra el modelo.
- Nombres sin espacios, tildes ni puntos. Aplica escala y rotación (`Ctrl + A`).
- Exporta como **glTF Binary (.glb)** en `public/models/z90-original.glb` y ejecuta `npm run optimizar-modelo` para comprimirlo en `public/models/z90.glb` (meta: menos de 10 MB).
- **Para probarlo mientras se construye:** abre **Ayuda → Probar un modelo .glb** o arrastra el archivo encima del visor. La página avisa qué piezas o controles no encontró.

## Ajustes en los datos

- `partes.json → explode`: hacia dónde se mueve cada pieza al expandir capas (la cámara mide 4 unidades).
- `recorrido.json → vista`: posición de la cámara para cada parte. `despiece: 1` obliga a ver por capas (filtro ND y sensor, que son internos); `null` respeta lo que eligió el estudiante.
- `uso.json → acciones`: tipo de movimiento (`mover`, `girar`, `pulsar`, `ocultar`, `mostrar`), dirección, ángulo y retraso. El campo `de` indica cómo empieza la pieza, por ejemplo la batería afuera.
- `uso.json → pantalla`: qué cambia en la pantalla simulada al completar el paso.

## Publicar

La página está lista para **GitHub Pages** con la dirección **https://z90.uao.edu.co**. El paso a paso completo, incluido lo que debe hacer la oficina de sistemas con el DNS, está en [`DESPLIEGUE.md`](DESPLIEGUE.md).

- `.github/workflows/publicar.yml` construye y publica la página en cada cambio a `main`.
- Las fuentes (Rubik e Inter) vienen dentro del proyecto, así que no dependen de Google Fonts.
- `public/og.jpg` es la imagen que aparece al compartir el enlace en WhatsApp, redes o correo.

---

Proyecto educativo, no afiliado a Sony. Contenido basado en el tutorial del CPMA. Verifica las especificaciones con la Guía de ayuda oficial de la PXW-Z90V.
