/* Refinamiento del símbolo de Fluws sobre el concepto de gateway.
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/fluws-symbol-directions.js [carpeta]

   Punto de partida: el símbolo que vino con el brand board es anillo–rombo–
   anillo, SIMÉTRICO. Dice "esto pasa por acá" pero no dice "sale distinto".
   Todo lo que sigue explora romper esa simetría, que es lo que separa un
   gateway genérico de un símbolo propietario.

   Tres direcciones + los híbridos:
     G — Gateway:        dos flujos atravesando un núcleo
     T — Transformation: entra simple, sale transformado
     P — Pulse:          una señal atraviesa y emerge con otra forma
     H — Gateway + Transformation

   Lenguaje visual calcado del brand board: color plano #18C7A5 (no degradado),
   trazo con caps y uniones redondas, anillos huecos como terminales, fondo
   #0B0F14. */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BRAND = '#18C7A5';
const INK = '#0B0F14';
const WHITE = '#FFFFFF';

const STROKE = 18;
/** Espacio común. El símbolo es apaisado (razón ~2.1), no cuadrado. */
const VIEWBOX = '0 24 580 272';

/** El núcleo: rombo de 240×192 centrado en (290,160). */
const CORE = 'M170 160L290 64L410 160L290 256Z';

/* Cada elemento es {d} para trazo, {c,r} anillo hueco, {c,r,solid} macizo. */
const DIRECTIONS = [
  {
    id: 'ref',
    label: 'REF · El símbolo dado',
    note: 'Simétrico. Gateway sí, transformación no: lo que entra es igual a lo que sale.',
    els: [
      { c: [56, 160], r: 28 },
      { d: 'M84 160H170' },
      { d: CORE },
      { d: 'M410 160H496' },
      { c: [524, 160], r: 28 },
    ],
  },
  {
    id: 'g1',
    label: 'G1 · Dos flujos atravesando',
    note: 'Todo converge en el núcleo y vuelve a abrirse. Gateway puro, sin terminales.',
    els: [
      { d: 'M20 96C110 96 140 160 170 160' },
      { d: 'M20 224C110 224 140 160 170 160' },
      { d: CORE },
      { d: 'M410 160C440 160 470 96 560 96' },
      { d: 'M410 160C440 160 470 224 560 224' },
    ],
  },
  {
    id: 'g2',
    label: 'G2 · Núcleo abierto',
    note: 'La señal atraviesa de lado a lado y el núcleo la envuelve sin cortarla.',
    els: [
      { c: [56, 160], r: 28 },
      { d: 'M84 160H496' },
      { d: 'M200 132L290 64L380 132' },
      { d: 'M200 188L290 256L380 188' },
      { c: [524, 160], r: 28 },
    ],
  },
  {
    id: 't1',
    label: 'T1 · Muchas entran, una sale',
    note: 'Literalmente la tesis: conversations (plural) into action (singular).',
    els: [
      { c: [46, 76], r: 22 },
      { c: [46, 160], r: 22 },
      { c: [46, 244], r: 22 },
      { d: 'M68 76C120 76 140 160 170 160' },
      { d: 'M68 160H170' },
      { d: 'M68 244C120 244 140 160 170 160' },
      { d: CORE },
      { d: 'M410 160H500' },
      { c: [528, 160], r: 26, solid: true },
    ],
  },
  {
    id: 't2',
    label: 'T2 · Caos entra, orden sale',
    note: 'Entra una conversación desordenada, sale una acción recta y resuelta.',
    els: [
      { d: 'M14 160C42 114 70 206 98 160C124 118 148 196 170 160' },
      { d: CORE },
      { d: 'M410 160H500' },
      { c: [528, 160], r: 26, solid: true },
    ],
  },
  {
    id: 't3',
    label: 'T3 · Hueco entra, macizo sale',
    note: 'La edición mínima sobre el arte comprado: potencial a la izquierda, hecho a la derecha.',
    els: [
      { c: [56, 160], r: 28 },
      { d: 'M84 160H170' },
      { d: CORE },
      { d: 'M410 160H496' },
      { c: [524, 160], r: 28, solid: true },
    ],
  },
  {
    id: 'p1',
    label: 'P1 · Pulso',
    note: 'Entra plana y sale con vida. El núcleo no la enruta: la activa.',
    els: [
      { c: [56, 160], r: 28 },
      { d: 'M84 160H170' },
      { d: CORE },
      { d: 'M410 160H432L452 100L474 220L492 160H514' },
      { c: [542, 160], r: 26 },
    ],
  },
  {
    id: 'h1',
    label: 'H1 · Conversación → acción',
    note: 'Gateway + Transformation. Entra una conversación de ida y vuelta, sale una sola acción.',
    els: [
      { c: [40, 96], r: 22 },
      { c: [40, 224], r: 22 },
      { d: 'M62 96C120 96 140 160 170 160' },
      { d: 'M62 224C120 224 140 160 170 160' },
      { d: CORE },
      { d: 'M410 160H500' },
      { c: [528, 160], r: 26, solid: true },
    ],
  },
  {
    id: 'h2',
    label: 'H2 · Con núcleo vivo',
    note: 'Igual que H1 pero el rombo tiene centro: adentro hay algo que decide, no un caño.',
    els: [
      { d: 'M20 96C100 96 140 160 170 160' },
      { d: 'M20 224C100 224 140 160 170 160' },
      { d: CORE },
      { c: [290, 160], r: 18, solid: true },
      { d: 'M410 160H500' },
      { c: [528, 160], r: 26, solid: true },
    ],
  },
];

const glyph = (dir, color) =>
  `<g stroke="${color}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round" fill="none">` +
  dir.els
    .map((el) =>
      el.d
        ? `<path d="${el.d}"/>`
        : `<circle cx="${el.c[0]}" cy="${el.c[1]}" r="${el.r}"${el.solid ? ` fill="${color}"` : ''}/>`
    )
    .join('') +
  '</g>';

/* Ícono de app: el símbolo apaisado metido en un cuadrado, como en el brand
   board. Queda chico por fuerza — es la prueba más dura de todas. */
const appIcon = (dir, bg, fg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="115" fill="${bg}"/>
    <svg x="46" y="46" width="420" height="420" viewBox="${VIEWBOX}">${glyph(dir, fg)}</svg>
  </svg>`;

const CELL_W = 640;
const CELL_H = 452;
const COLS = 3;
const FONT = 'Segoe UI, Arial, sans-serif';

/** Corte por palabras. SVG no reflowea texto: sin esto la nota se sale de la
 *  tarjeta y pisa la de al lado. */
function wrap(text, max) {
  const lines = [''];
  for (const word of text.split(' ')) {
    const line = lines[lines.length - 1];
    if (line && (line + ' ' + word).length > max) lines.push(word);
    else lines[lines.length - 1] = line ? line + ' ' + word : word;
  }
  return lines;
}

function sheet() {
  const rows = Math.ceil(DIRECTIONS.length / COLS);
  const W = COLS * CELL_W;
  const H = rows * CELL_H + 110;

  const cells = DIRECTIONS.map((dir, i) => {
    const x = (i % COLS) * CELL_W;
    const y = Math.floor(i / COLS) * CELL_H + 110;
    return `
    <g transform="translate(${x} ${y})">
      <rect x="20" y="14" width="${CELL_W - 40}" height="${CELL_H - 38}" rx="26"
            fill="#11161D" stroke="#1E2630" stroke-width="2"/>

      <!-- Símbolo grande -->
      <svg x="50" y="46" width="540" height="253" viewBox="${VIEWBOX}">${glyph(dir, BRAND)}</svg>

      <!-- Fila de pruebas: chico, icono oscuro, icono verde -->
      <svg x="50" y="312" width="150" height="70" viewBox="${VIEWBOX}">${glyph(dir, BRAND)}</svg>
      <svg x="218" y="312" width="66" height="66" viewBox="0 0 512 512">${appIcon(dir, INK, BRAND)}</svg>
      <svg x="296" y="312" width="66" height="66" viewBox="0 0 512 512">${appIcon(dir, BRAND, WHITE)}</svg>

      <text x="392" y="342" font-family="${FONT}" font-size="26" font-weight="600" fill="${WHITE}">${dir.label.split(' · ')[0]}</text>
      <text x="392" y="372" font-family="${FONT}" font-size="21" fill="#7C8896">${dir.label.split(' · ')[1]}</text>

      ${wrap(dir.note, 62)
        .map(
          (line, n) =>
            `<text x="50" y="${410 + n * 26}" font-family="${FONT}" font-size="20" fill="#7C8896">${line}</text>`
        )
        .join('')}
    </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <text x="46" y="58" font-family="${FONT}" font-size="34" font-weight="700" fill="${WHITE}">fluws — refinamiento del símbolo</text>
    <text x="46" y="90" font-family="${FONT}" font-size="22" fill="#7C8896">El dado es simétrico: dice "pasa por acá", no dice "sale distinto". Todo lo demás rompe esa simetría.</text>
    ${cells}
  </svg>`;
}

(async () => {
  const outDir = process.argv[2] || 'scripts/out';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'simbolo-direcciones.png');
  await sharp(Buffer.from(sheet())).png().toFile(file);
  console.log('listo →', path.resolve(file));
})();
