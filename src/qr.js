// Código QR en SVG (sin servicios externos)
import qrcode from 'qrcode-generator';

export function qrSVG(texto) {
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
