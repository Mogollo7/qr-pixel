// Matriz QR (RF-QR). Usa la librería global qrcode-generator.

export const MAX_VERSION = 40;

export function makeQR(text, ecc = 'M', minVersion = 1) {
  if (typeof qrcode !== 'function') throw new Error('qrcode-generator no cargó');
  const data = text && text.length ? text : ' ';
  // UTF-8 para tildes, eñes y emojis (por defecto la librería trunca a un byte por carácter)
  if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  for (let v = Math.max(1, minVersion); v <= MAX_VERSION; v++) {
    try {
      const qr = qrcode(v, ecc);
      qr.addData(data);
      qr.make();
      const n = qr.getModuleCount();
      const m = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
      return { matrix: m, version: v, size: n };
    } catch (e) {
      /* desbordamiento: probar versión mayor */
    }
  }
  throw new Error('El texto es demasiado largo para un QR');
}
