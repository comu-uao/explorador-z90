// Motor de imagen del laboratorio: simula exposición, color, ruido, desenfoque, temblor, cebra y peaking
// sobre fotos reales del tutorial. Trabaja en luz lineal para que los pasos de exposición sean reales.
const cache = new Map();

export function cargar(src) {
  if (!cache.has(src)) {
    cache.set(src, new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, 0, 0);
        res(x.getImageData(0, 0, c.width, c.height));
      };
      img.onerror = rej;
      img.src = src;
    }));
  }
  return cache.get(src);
}

const LIN = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const N = 4096;
const SRGB = new Uint8ClampedArray(N + 1).map((_, i) => { const l = i / N; return Math.round((l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055) * 255); });
const aIdx = (v) => (v <= 0 ? 0 : v >= 1 ? N : (v * N) | 0);

let ruido = null;
function ruidoGauss(n) {
  if (ruido && ruido.length === n) return ruido;
  ruido = new Float32Array(n);
  for (let i = 0; i < n; i += 2) {
    const u = Math.random() || 1e-9, v = Math.random();
    const r = Math.sqrt(-2 * Math.log(u));
    ruido[i] = r * Math.cos(2 * Math.PI * v);
    if (i + 1 < n) ruido[i + 1] = r * Math.sin(2 * Math.PI * v);
  }
  return ruido;
}

// Desenfoque de caja separable (horizontal y vertical)
function cajaH(src, w, h, r) {
  const out = new Uint8ClampedArray(src.length), win = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[(y * w + Math.min(w - 1, Math.max(0, k))) * 4 + c];
      for (let x = 0; x < w; x++) {
        out[(y * w + x) * 4 + c] = acc / win;
        const sale = Math.max(0, x - r), entra = Math.min(w - 1, x + r + 1);
        acc += src[(y * w + entra) * 4 + c] - src[(y * w + sale) * 4 + c];
      }
    }
  }
  return out;
}
function cajaV(src, w, h, r) {
  const out = new Uint8ClampedArray(src.length), win = 2 * r + 1;
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[(Math.min(h - 1, Math.max(0, k)) * w + x) * 4 + c];
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 4 + c] = acc / win;
        const sale = Math.max(0, y - r), entra = Math.min(h - 1, y + r + 1);
        acc += src[(entra * w + x) * 4 + c] - src[(sale * w + x) * 4 + c];
      }
    }
  }
  return out;
}

// Factores de color por diferencia entre la luz y el balance elegido (pasos en escala de temperatura)
export function factoresWB(pasos) {
  return { r: 2 ** (0.32 * pasos), g: 1, b: 2 ** (-0.42 * pasos) };
}

// o: { gain, wb (pasos: + cálido, − frío), ruido, blur, temblor, cebra, peaking:{puntos,color} }
export function procesar(base, o = {}) {
  const { width: w, height: h } = base;
  let px = base.data;
  if (o.blur) { const r = Math.round(o.blur); px = cajaV(cajaH(px, w, h, r), w, h, r); }
  if (o.temblor) {
    const m = cajaH(px, w, h, Math.round(o.temblor));
    const mix = new Uint8ClampedArray(px.length);
    for (let i = 0; i < px.length; i++) mix[i] = (px[i] * 0.35 + m[i] * 0.65);
    px = mix;
  }
  const out = new ImageData(w, h);
  const d = out.data;
  const g = o.gain ?? 1;
  const f = factoresWB(o.wb || 0);
  const mr = f.r * g, mg = f.g * g, mb = f.b * g;
  const amp = o.ruido || 0;
  const rn = amp ? ruidoGauss(w * h) : null;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    let r = LIN[px[i]] * mr, gg = LIN[px[i + 1]] * mg, b = LIN[px[i + 2]] * mb;
    if (amp) { const n = rn[p] * amp; r += n; gg += n * 0.9; b += n * 1.1; }
    d[i] = SRGB[aIdx(r)]; d[i + 1] = SRGB[aIdx(gg)]; d[i + 2] = SRGB[aIdx(b)]; d[i + 3] = 255;
  }
  if (o.cebra) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      if (l >= 240 && ((x + y) >> 2) & 1) { d[i] = d[i + 1] = d[i + 2] = 70; }
    }
  }
  if (o.peaking) {
    const [cr, cg, cb] = o.peaking.color;
    for (const p of o.peaking.puntos) { const i = p * 4; d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; }
  }
  return out;
}

// Puntos con mucho detalle (para dibujar el peaking)
export function bordes(base, proporcion = 0.06) {
  const { width: w, height: h, data: s } = base;
  const L = (x, y) => { const i = (y * w + x) * 4; return 0.3 * s[i] + 0.59 * s[i + 1] + 0.11 * s[i + 2]; };
  const mags = [];
  for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) {
    const gx = L(x + 1, y) - L(x - 1, y), gy = L(x, y + 1) - L(x, y - 1);
    mags.push([gx * gx + gy * gy, y * w + x]);
  }
  mags.sort((a, b) => b[0] - a[0]);
  return mags.slice(0, Math.floor(mags.length * proporcion)).map((m) => m[1]);
}

export function histograma(img, bins = 64) {
  const hst = new Uint32Array(bins), d = img.data;
  for (let i = 0; i < d.length; i += 16) {
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    hst[Math.min(bins - 1, (l / 256 * bins) | 0)]++;
  }
  return hst;
}

export function dibujarHist(canvas, hst) {
  const x = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  x.clearRect(0, 0, w, h);
  x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 0, w, h);
  const max = Math.max(...hst) || 1;
  const bw = w / hst.length;
  hst.forEach((v, i) => {
    const bh = Math.sqrt(v / max) * (h - 6);
    x.fillStyle = (i === 0 || i === hst.length - 1) && v > max * 0.25 ? '#ff6b7d' : 'rgba(255,255,255,.9)';
    x.fillRect(i * bw, h - 3 - bh, Math.max(1, bw - 0.5), bh);
  });
}
