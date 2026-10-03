// Parámetros, moldes base y esquema de la interfaz (RF-MOL, RF-PER).
// Todas las medidas anatómicas son fracciones de la longitud hocico-cloaca (LHC).

export const BASE = {
  // QR
  text: 'https://example.com', ecc: 'M', minVersion: 1, quiet: 2,
  qrStyle: 'tint', darkColor: '#101010', lightColor: '#f6f4ea', qrRelief: 1,
  // resolución global: nº de cubos a lo largo del cuerpo
  res: 64,
  // tronco
  bodyW: 0.21, bodyH: 0.125, bodyN: 2.4, tilt: 0.6, hump: 0.4, taper: 1,
  // cabeza
  headW: 0.95, headL: 0.33, headH: 0.85, snout: 0.35,
  // ojos
  eyeSize: 0.055, eyeSep: 0.85, eyePos: 0.62, eyeProt: 0.5, eyeFront: 0.1,
  pupil: 'hslit', pupilSize: 0.5, tympanum: 0.03,
  // extremidades
  frontLen: 0.38, frontThick: 0.032, frontSplay: 0.5,
  hindThigh: 0.4, hindShin: 0.42, hindFoot: 0.4, hindThick: 0.045, hindFold: 1,
  toeLen: 0.12, toePad: 0.01, webbing: 0.3,
  // rasgos con volumen
  parotoid: 0, crests: 0, warts: 0,
  // patrones
  vertebral: 0, dorsolateral: 0, dlPos: 0.7, eyeLine: 0, eyeLineLen: 0.6, interorbital: 0,
  spots: 0, spotSize: 0.06, legBands: 0, mottle: 0.08, gradient: 0.3,
  // translucidez
  glass: 0, organs: 0, seed: 7,
  // paleta
  cBack: '#5f8f3a', cBack2: '#7aa84a', cBelly: '#e6e2c2', cFlank: '#86a857',
  cToe: '#9cb86a', cPad: '#d8e0a8', cIris: '#d8a032', cPupil: '#0b0b0b', cTymp: '#6f7f45',
  cLine: '#26331a', cSpot: '#2f4a22', cGland: '#4f6f30', cWart: '#44602a',
  cHeart: '#c62828', cLiver: '#5b2a2a', cGut: '#e7c8c0', cGlass: '#cfe8dc',
};

// lo que se conserva al cambiar de molde
const KEEP = ['text', 'ecc', 'minVersion', 'quiet', 'qrStyle', 'darkColor', 'lightColor', 'qrRelief', 'res'];

export const MOLDS = {
  minecraft: {
    label: 'Rana de Minecraft (base)',
    blurb: 'El punto de partida: cuerpo en bloque, ojos arriba y patas cortas.',
    p: {
      bodyW: 0.24, bodyH: 0.11, bodyN: 7, tilt: 0.35, hump: 0, taper: 1.15,
      headW: 1, headL: 0.36, headH: 1, snout: 0,
      eyeSize: 0.07, eyeSep: 0.75, eyePos: 0.7, eyeProt: 0.9, pupil: 'hslit', pupilSize: 0.6, tympanum: 0,
      frontLen: 0.3, frontThick: 0.04, frontSplay: 0.6,
      hindThigh: 0.3, hindShin: 0.3, hindFoot: 0.3, hindThick: 0.055, toeLen: 0.1, toePad: 0, webbing: 0.8,
      mottle: 0.05, gradient: 0.15, spots: 0.08,
      cBack: '#d07a3a', cBack2: '#e39a52', cBelly: '#f1e3b5', cFlank: '#c9803f', cToe: '#e3a45e', cPad: '#f1d59a',
      cIris: '#f2f2e6', cLine: '#7a3f1a', cSpot: '#a85a26', cTymp: '#b86a30', cGland: '#a85a26', cWart: '#8f4a20',
    },
  },
  rhinella: {
    label: 'Rhinella horribilis',
    blurb: 'Sapo robusto: cabeza ancha, parotoides enormes, crestas craneales y verrugas.',
    p: {
      bodyW: 0.27, bodyH: 0.15, bodyN: 2.3, tilt: 0.75, hump: 0.25, taper: 1.05,
      headW: 0.92, headL: 0.3, headH: 0.82, snout: 0.15,
      eyeSize: 0.058, eyeSep: 0.8, eyePos: 0.6, eyeProt: 0.45, pupil: 'hslit', tympanum: 0.034,
      frontLen: 0.36, frontThick: 0.045, frontSplay: 0.45,
      hindThigh: 0.33, hindShin: 0.34, hindFoot: 0.34, hindThick: 0.06, toeLen: 0.11, toePad: 0, webbing: 0.5,
      parotoid: 0.95, crests: 0.7, warts: 0.6, spots: 0.16, spotSize: 0.07, mottle: 0.16, gradient: 0.35,
      cBack: '#6a5636', cBack2: '#8b7048', cBelly: '#d9cdaa', cFlank: '#8f7a52', cToe: '#a08a5e', cPad: '#3a2c18',
      cLine: '#2a2014', cSpot: '#3d2e1c', cGland: '#9a7a48', cWart: '#4a3a22', cIris: '#c9a43a', cTymp: '#7d6842',
    },
  },
  pristimantis: {
    label: 'Pristimantis',
    blurb: 'Cabeza grande, ojos saltones, discos digitales y la franja oscura que cruza el ojo hacia el cuerpo.',
    p: {
      bodyW: 0.19, bodyH: 0.11, bodyN: 2.4, tilt: 0.7, hump: 0.55, taper: 0.9,
      headW: 1.05, headL: 0.38, headH: 0.9, snout: 0.45,
      eyeSize: 0.07, eyeSep: 0.86, eyePos: 0.6, eyeProt: 0.7, pupil: 'hslit', tympanum: 0.022,
      frontLen: 0.42, frontThick: 0.024, frontSplay: 0.5,
      hindThigh: 0.48, hindShin: 0.52, hindFoot: 0.46, hindThick: 0.036, toeLen: 0.14, toePad: 0.024, webbing: 0,
      eyeLine: 0.6, eyeLineLen: 0.62, interorbital: 0.5, legBands: 0.8, dorsolateral: 0, mottle: 0.1, gradient: 0.4, spots: 0.06,
      cBack: '#9a7b4f', cBack2: '#b99a68', cBelly: '#e8dcc0', cFlank: '#a98a5c', cToe: '#c8ae80', cPad: '#efe2bf',
      cLine: '#2b1d12', cSpot: '#6b4e2e', cIris: '#c8742a', cTymp: '#7a5c36', cGland: '#7a5c36', cWart: '#6b4e2e',
    },
  },
  glass: {
    label: 'Rana de cristal',
    blurb: 'Pequeña y plana, ojos hacia el frente, dorso verde con puntos y vientre translúcido con órganos.',
    p: {
      bodyW: 0.2, bodyH: 0.095, bodyN: 2.6, tilt: 0.4, hump: 0.2, taper: 0.95,
      headW: 1.05, headL: 0.3, headH: 0.95, snout: 0.05,
      eyeSize: 0.062, eyeSep: 0.7, eyePos: 0.42, eyeProt: 0.6, eyeFront: 0.75, pupil: 'hslit', pupilSize: 0.45, tympanum: 0,
      frontLen: 0.44, frontThick: 0.022, frontSplay: 0.7,
      hindThigh: 0.46, hindShin: 0.5, hindFoot: 0.42, hindThick: 0.03, toeLen: 0.13, toePad: 0.026, webbing: 0.35,
      spots: 0.2, spotSize: 0.022, mottle: 0.05, gradient: 0.4, glass: 0.6, organs: 1,
      cBack: '#6fbf4a', cBack2: '#92d664', cBelly: '#e8f3ea', cFlank: '#a9dd8a', cToe: '#9ad676', cPad: '#d8f0b8',
      cSpot: '#f1f0a0', cIris: '#ecead0', cLine: '#2d5a2b', cTymp: '#6fbf4a', cGlass: '#d4f0e2',
    },
  },
  atelopus: {
    label: 'Atelopus (rana arlequín)',
    blurb: 'Cuerpo estrecho y alargado, hocico puntiagudo, patas finas y colores de advertencia.',
    p: {
      bodyW: 0.15, bodyH: 0.09, bodyN: 2.6, tilt: 0.85, hump: 0.3, taper: 0.9,
      headW: 0.95, headL: 0.3, headH: 0.9, snout: 0.8,
      eyeSize: 0.045, eyeSep: 0.85, eyePos: 0.62, eyeProt: 0.4, pupil: 'round', pupilSize: 0.6, tympanum: 0,
      frontLen: 0.5, frontThick: 0.022, frontSplay: 0.55,
      hindThigh: 0.44, hindShin: 0.44, hindFoot: 0.36, hindThick: 0.03, toeLen: 0.11, toePad: 0, webbing: 0.4,
      spots: 0.3, spotSize: 0.06, vertebral: 0, mottle: 0.04, gradient: 0.15, legBands: 0.6,
      cBack: '#f2c200', cBack2: '#ffd83a', cBelly: '#ea9d00', cFlank: '#e0b000', cToe: '#e8b000', cPad: '#f0c020',
      cLine: '#111111', cSpot: '#141414', cIris: '#1a1a1a', cTymp: '#e0b000',
    },
  },
};

export function moldParams(id, keep = {}) {
  const out = { ...BASE, ...MOLDS[id].p };
  for (const k of KEEP) if (k in keep) out[k] = keep[k];
  return out;
}

const sel = (...v) => v;

export const TABS = [
  { id: 'molde', title: 'Molde', groups: [] },
  {
    id: 'qr', title: 'QR', groups: [
      { title: 'Contenido', controls: [
        { k: 'text', t: 'text', label: 'Texto o URL' },
        { k: 'ecc', t: 'select', label: 'Corrección de errores', opts: sel(['L', 'L · 7%'], ['M', 'M · 15%'], ['Q', 'Q · 25%'], ['H', 'H · 30%']) },
        { k: 'minVersion', t: 'range', label: 'Versión mínima', min: 1, max: 10, step: 1 },
        { k: 'quiet', t: 'range', label: 'Margen claro (módulos)', min: 2, max: 4, step: 1 },
      ] },
      { title: 'Aspecto del QR', controls: [
        { k: 'qrStyle', t: 'select', label: 'Color de los cubos', opts: sel(['tint', 'Colores de la rana (oscurecidos)'], ['custom', 'Dos colores a elegir']) },
        { k: 'darkColor', t: 'color', label: 'Oscuro (modo dos colores)' },
        { k: 'lightColor', t: 'color', label: 'Claro' },
        { k: 'qrRelief', t: 'range', label: 'Relieve de módulos oscuros', min: 0, max: 3, step: 1 },
      ] },
    ],
  },
  {
    id: 'cuerpo', title: 'Cuerpo', groups: [
      { title: 'Resolución', controls: [
        { k: 'res', t: 'range', label: 'Cubos a lo largo del cuerpo', min: 16, max: 128, step: 2 },
      ] },
      { title: 'Tronco', controls: [
        { k: 'bodyW', t: 'range', label: 'Ancho', min: 0.12, max: 0.32, step: 0.005 },
        { k: 'bodyH', t: 'range', label: 'Alto', min: 0.07, max: 0.2, step: 0.005 },
        { k: 'bodyN', t: 'range', label: 'Cuadratura (2 redondo · 8 bloque)', min: 2, max: 8, step: 0.1 },
        { k: 'tilt', t: 'range', label: 'Postura erguida', min: 0, max: 1.2, step: 0.01 },
        { k: 'hump', t: 'range', label: 'Joroba sacra', min: 0, max: 1, step: 0.01 },
        { k: 'taper', t: 'range', label: 'Ancho de cadera', min: 0.6, max: 1.25, step: 0.01 },
      ] },
      { title: 'Cabeza', controls: [
        { k: 'headW', t: 'range', label: 'Ancho', min: 0.7, max: 1.25, step: 0.01 },
        { k: 'headL', t: 'range', label: 'Largo', min: 0.24, max: 0.44, step: 0.005 },
        { k: 'headH', t: 'range', label: 'Alto', min: 0.6, max: 1.15, step: 0.01 },
        { k: 'snout', t: 'range', label: 'Hocico puntiagudo', min: 0, max: 1, step: 0.01 },
      ] },
      { title: 'Ojos', controls: [
        { k: 'eyeSize', t: 'range', label: 'Tamaño', min: 0.03, max: 0.09, step: 0.002 },
        { k: 'eyeSep', t: 'range', label: 'Separación', min: 0.45, max: 1, step: 0.01 },
        { k: 'eyePos', t: 'range', label: 'Posición (hocico → nuca)', min: 0.3, max: 0.9, step: 0.01 },
        { k: 'eyeProt', t: 'range', label: 'Protuberancia', min: 0, max: 1, step: 0.01 },
        { k: 'eyeFront', t: 'range', label: 'Mirada frontal', min: 0, max: 1, step: 0.01 },
        { k: 'pupil', t: 'select', label: 'Pupila', opts: sel(['round', 'Redonda'], ['hslit', 'Horizontal'], ['vslit', 'Vertical']) },
        { k: 'pupilSize', t: 'range', label: 'Tamaño de pupila', min: 0.2, max: 0.9, step: 0.01 },
        { k: 'tympanum', t: 'range', label: 'Tímpano', min: 0, max: 0.06, step: 0.002 },
      ] },
    ],
  },
  {
    id: 'extrem', title: 'Patas', groups: [
      { title: 'Delanteras', controls: [
        { k: 'frontLen', t: 'range', label: 'Largo', min: 0.2, max: 0.65, step: 0.01 },
        { k: 'frontThick', t: 'range', label: 'Grosor', min: 0.015, max: 0.07, step: 0.001 },
        { k: 'frontSplay', t: 'range', label: 'Apertura', min: 0, max: 1, step: 0.01 },
      ] },
      { title: 'Traseras', controls: [
        { k: 'hindThigh', t: 'range', label: 'Muslo', min: 0.22, max: 0.6, step: 0.01 },
        { k: 'hindShin', t: 'range', label: 'Tibia', min: 0.22, max: 0.65, step: 0.01 },
        { k: 'hindFoot', t: 'range', label: 'Pie', min: 0.2, max: 0.6, step: 0.01 },
        { k: 'hindThick', t: 'range', label: 'Grosor', min: 0.02, max: 0.09, step: 0.001 },
        { k: 'hindFold', t: 'range', label: 'Pose (0 estirada · 1 sentada)', min: 0, max: 1, step: 0.01 },
      ] },
      { title: 'Dedos', controls: [
        { k: 'toeLen', t: 'range', label: 'Largo de dedos', min: 0.05, max: 0.22, step: 0.005 },
        { k: 'toePad', t: 'range', label: 'Discos adhesivos', min: 0, max: 0.04, step: 0.001 },
        { k: 'webbing', t: 'range', label: 'Membrana', min: 0, max: 1, step: 0.01 },
      ] },
    ],
  },
  {
    id: 'piel', title: 'Piel', groups: [
      { title: 'Rasgos con volumen', controls: [
        { k: 'parotoid', t: 'range', label: 'Glándulas parotoides', min: 0, max: 1.3, step: 0.01 },
        { k: 'crests', t: 'range', label: 'Crestas craneales', min: 0, max: 1, step: 0.01 },
        { k: 'warts', t: 'range', label: 'Verrugas', min: 0, max: 1, step: 0.01 },
        { k: 'glass', t: 'range', label: 'Translucidez del vientre', min: 0, max: 1, step: 0.01 },
        { k: 'organs', t: 'check', label: 'Órganos internos' },
      ] },
      { title: 'Patrones', controls: [
        { k: 'eyeLine', t: 'range', label: 'Franja a través del ojo', min: 0, max: 1, step: 0.01 },
        { k: 'eyeLineLen', t: 'range', label: 'Largo de la franja', min: 0.25, max: 1, step: 0.01 },
        { k: 'interorbital', t: 'range', label: 'Barra entre los ojos', min: 0, max: 1, step: 0.01 },
        { k: 'vertebral', t: 'range', label: 'Línea vertebral', min: 0, max: 0.06, step: 0.002 },
        { k: 'dorsolateral', t: 'range', label: 'Líneas dorsolaterales', min: 0, max: 0.15, step: 0.005 },
        { k: 'dlPos', t: 'range', label: 'Posición dorsolateral', min: 0.3, max: 0.95, step: 0.01 },
        { k: 'spots', t: 'range', label: 'Manchas (densidad)', min: 0, max: 0.45, step: 0.01 },
        { k: 'spotSize', t: 'range', label: 'Tamaño de manchas', min: 0.02, max: 0.14, step: 0.002 },
        { k: 'legBands', t: 'range', label: 'Barras en patas', min: 0, max: 1, step: 0.01 },
        { k: 'mottle', t: 'range', label: 'Variación por cubo', min: 0, max: 0.35, step: 0.01 },
        { k: 'gradient', t: 'range', label: 'Mezcla de dorso 2', min: 0, max: 1, step: 0.01 },
        { k: 'seed', t: 'range', label: 'Semilla', min: 1, max: 999, step: 1 },
      ] },
      { title: 'Paleta', controls: [
        { k: 'cBack', t: 'color', label: 'Dorso' }, { k: 'cBack2', t: 'color', label: 'Dorso 2' },
        { k: 'cBelly', t: 'color', label: 'Vientre y garganta' }, { k: 'cFlank', t: 'color', label: 'Flancos' },
        { k: 'cToe', t: 'color', label: 'Dedos' }, { k: 'cPad', t: 'color', label: 'Discos' },
        { k: 'cIris', t: 'color', label: 'Iris' }, { k: 'cPupil', t: 'color', label: 'Pupila' },
        { k: 'cTymp', t: 'color', label: 'Tímpano' },
        { k: 'cLine', t: 'color', label: 'Líneas / barras / boca' }, { k: 'cSpot', t: 'color', label: 'Manchas' },
        { k: 'cGland', t: 'color', label: 'Parotoides / crestas' }, { k: 'cWart', t: 'color', label: 'Verrugas' },
        { k: 'cHeart', t: 'color', label: 'Corazón' }, { k: 'cLiver', t: 'color', label: 'Hígado' },
        { k: 'cGut', t: 'color', label: 'Intestino' }, { k: 'cGlass', t: 'color', label: 'Cristal' },
      ] },
    ],
  },
];

export const CONTROL_INDEX = {};
for (const t of TABS) for (const g of t.groups) for (const c of g.controls) CONTROL_INDEX[c.k] = c;

export const PALETTE_KEYS = TABS.find((t) => t.id === 'piel').groups[2].controls.map((c) => [c.k, c.label]);
