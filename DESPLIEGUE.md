# Publicar el Explorador 3D Z90V en z90.uao.edu.co

Guía para publicar la página en **GitHub Pages** (gratis) con la dirección **https://z90.uao.edu.co**.
El proyecto ya trae todo lo necesario: cada vez que se sube un cambio a la rama `main`, GitHub construye y publica la página solo (archivo `.github/workflows/publicar.yml`).

Hay dos responsables:

- **Quien administra el proyecto** (pasos 1 a 3 y 5).
- **La oficina de sistemas de la universidad**, que maneja el dominio `uao.edu.co` (paso 4).

---

## 1. Crear el repositorio

1. Entra a [github.com](https://github.com) con la cuenta del proyecto. Lo ideal es una **organización** de la universidad o del CPMA (por ejemplo `cpma-uao`), para que la página no dependa de una cuenta personal.
2. Crea un repositorio **público** llamado `explorador-z90`. No agregues README ni licencia: el proyecto ya los trae.

## 2. Subir el proyecto

**Opción A: con Git (recomendada).** El proyecto ya viene con el primer commit hecho. Desde la carpeta `explorador-z90`:

```bash
git remote add origin https://github.com/CUENTA/explorador-z90.git
git push -u origin main
```

**Opción B: desde el navegador.** En el repositorio vacío, elige *uploading an existing file* y arrastra **todo el contenido** de la carpeta, excepto `node_modules` y `dist`.
Importante: la carpeta `.github` está oculta. Muéstrala antes de arrastrar (en Mac, `Cmd + Shift + .`; en Windows, Explorador → Vista → Elementos ocultos). Sin ella la página no se publica sola.

## 3. Activar GitHub Pages

1. En el repositorio: **Settings → Pages**.
2. En *Build and deployment → Source*, elige **GitHub Actions**.
3. Ve a la pestaña **Actions**: verás «Publicar en GitHub Pages» corriendo. Tarda 1 o 2 minutos.
4. Al terminar, la página queda en `https://CUENTA.github.io/explorador-z90/`. Revísala antes de seguir.

## 4. Dirección propia: z90.uao.edu.co (oficina de sistemas)

**4.1 Registro DNS.** En la zona `uao.edu.co`, crear:

| Tipo | Nombre / host | Valor |
|---|---|---|
| CNAME | `z90` | `CUENTA.github.io` |

El valor es solo `CUENTA.github.io`, **sin** el nombre del repositorio. Cambia `CUENTA` por la cuenta u organización del paso 1.

**4.2 Conectar el dominio en GitHub.**

1. **Settings → Pages → Custom domain**: escribe `z90.uao.edu.co` y guarda.
2. Espera a que GitHub confirme el DNS. Puede tardar desde minutos hasta 24 horas, según la propagación.
3. Activa **Enforce HTTPS**. GitHub emite el certificado gratis; si la casilla aparece gris, espera a que termine de crearlo.
4. En `src/config.js` cambia `urlPublica` a `https://z90.uao.edu.co/` y en `index.html` las etiquetas `canonical` y `og:`. Así los códigos QR de la lista y de la realidad aumentada apuntan a la dirección nueva.

**4.3 Recomendado: verificar el dominio.** En la configuración de la organización: **Settings → Pages → Add a domain**, agrega `uao.edu.co` y crea el registro TXT que indique GitHub. Así nadie más puede usar subdominios de la universidad en GitHub Pages.

## 5. Mantener la página

- **Cualquier cambio** subido a `main` se publica solo en 1 o 2 minutos.
- **Modelo 3D final:** colócalo en `public/models/z90.glb` y súbelo. GitHub no acepta archivos de más de 100 MB; la meta es menos de 10 MB (ver `npm run optimizar-modelo` en el README).
- **Textos, preguntas y pasos:** están en `src/equipos/z90v/es/` (español) y `en/` (inglés).
- **Video:** `public/video/tutorial-z90.mp4`; subtítulos en `src/equipos/z90v/subtitulos/`.

## Antes de anunciarla

- [ ] Confirmar con el CPMA el permiso para usar las imágenes de su video tutorial.
- [ ] Revisar los datos técnicos con la Guía de ayuda oficial de la PXW-Z90V.
- [ ] Probar la página en un celular y en un computador de la universidad.
- [ ] Verificar que `https://z90.uao.edu.co` abre con candado (HTTPS).

## Alternativa: servidor propio de la universidad

Si sistemas prefiere alojarla en sus servidores:

```bash
npm install
npm run build
```

y subir **el contenido de la carpeta `dist/`** a la raíz del sitio `z90.uao.edu.co`. Es un sitio estático: no necesita base de datos ni PHP, solo un servidor web (Apache, Nginx o IIS) con HTTPS.
