// Configuración general del explorador.
// Cuando el modelo 3D esté listo, colócalo en public/models/z90.glb y no hay que cambiar nada más.

export const CONFIG = {
  // Ruta del modelo final. Si no existe, se muestra el modelo provisional de bloques.
  modelUrl: 'models/z90.glb',

  // Decodificador Draco (necesario si el GLB se comprime con Draco).
  // Para trabajar sin internet, copia node_modules/three/examples/jsm/libs/draco/ a public/draco/ y usa 'draco/'.
  dracoPath: 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/',

  // El modelo se escala para que su lado más largo mida 4 unidades y se centra en el origen.
  // Así las direcciones de despiece y las vistas de parts.json sirven para cualquier modelo.
  modelSize: 4,

  // Vista inicial y del botón "Reiniciar vista"
  defaultView: { pos: [-4.4, 2.5, 5.8], target: [0, 0.05, 0] },

  // Multiplica la distancia de las vistas de parts.json (en pantallas verticales se aleja un poco más)
  vistaEscala: 1.6,
  // Lo mismo para los acercamientos a botones en "Uso de la cámara"
  vistaControles: 1.3,

  // Duración de las animaciones de cámara y despiece (segundos)
  tweenDuration: 1.0,

  // Color de resaltado de la pieza seleccionada
  highlight: 0xd8213d,
};
