import { defineConfig } from 'vite';

// base './' sirve tanto en https://z90.uao.edu.co/ como en https://usuario.github.io/repositorio/
// UN_ARCHIVO=1 mete fotos y fuentes dentro del código (solo para la versión de vista previa de un solo archivo).
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1600,
    assetsInlineLimit: process.env.UN_ARCHIVO ? 200000 : 4096,
  },
});
