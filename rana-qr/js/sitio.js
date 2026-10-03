// Entradas del sitio (RF-PUB): datos compactos de una figura y su QR. Sin DOM: se usa en el navegador y en Node.

const b64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
};
const u8 = (arr) => new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);

export const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'modelo';

/**
 * Entrada de la colección a partir de los cubos ya calculados.
 * frog: Int16 ijk, frogRgb: Uint8 rgb, qr: Int16 (posición*2), qrRgb: Uint8 rgb, rnd: Uint8, flags: Uint8 (bit0 escala inicial, bit1 escala final).
 */
export function makeEntry({ label, text, L, H, side, frog, frogRgb, qr, qrRgb, rnd, flags }) {
  const n = frog.length / 3, misc = new Uint8Array(n * 2);
  for (let i = 0; i < n; i++) { misc[i * 2] = rnd[i]; misc[i * 2 + 1] = flags[i]; }
  return {
    id: slug(label), label: String(label).slice(0, 60), text: String(text).slice(0, 1200), L, H, side, n,
    frog: b64(u8(frog)), frogRgb: b64(frogRgb), qr: b64(u8(qr)), qrRgb: b64(qrRgb), misc: b64(misc),
  };
}
