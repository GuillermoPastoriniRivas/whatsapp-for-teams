/* Refinamiento de la dirección elegida: muchos a uno, SIN rombo.
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/fluws-symbol-many-to-one.js [carpeta]

   Al sacar el rombo, la transformación deja de estar en un objeto y pasa a
   estar en la convergencia misma. Por eso todas las variantes se juegan en el
   punto de encuentro: qué hay ahí, o qué falta ahí.

   Lenguaje visual del brand board: color plano #18C7A5, trazo con caps y
   uniones redondas, anillos huecos como entradas, fondo #0B0F14. */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BRAND = '#18C7A5';
const INK = '#0B0F14';
const WHITE = '#FFFFFF';

const STROKE = 18;
const VIEWBOX = '5 30 460 260';

/** Punto de convergencia, y la salida hasta el nodo de acción. */
const JOIN = [250, 160];
const OUT = 'M250 160H400';
const ACTION = { c: [428, 160], r: 26, solid: true };

/* Las tres entradas: anillo hueco + curva que sale horizontal y dobla al cruce.
   Salen horizontales a propósito — si apuntan directo al cruce, las tres leen
   como un abanico de flechas y no como flujos. */
const IN_RINGS = [
  { c: [46, 70], r: 22 },
  { c: [46, 160], r: 22 },
  { c: [46, 250], r: 22 },
];
const IN_EDGES = [
  { d: 'M68 70C140 70 170 160 250 160' },
  { d: 'M68 160H250' },
  { d: 'M68 250C140 250 170 160 250 160' },
];

const VARIANTS = [
  {
    id: 'n1',
    label: 'N1 · Convergencia limpia',
    note: 'Nada en el cruce. Lo que transforma es el hecho de juntarse.',
    els: [...IN_EDGES, ...IN_RINGS, { d: OUT }, ACTION],
  },
  {
    id: 'n2',
    label: 'N2 · Núcleo mínimo',
    note: 'Un punto macizo en el cruce: adentro hay algo que decide.',
    els: [...IN_EDGES, ...IN_RINGS, { c: JOIN, r: 20, solid: true }, { d: OUT }, ACTION],
  },
  {
    id: 'n3',
    label: 'N3 · Núcleo hueco',
    note: 'El cruce es un anillo, igual que las entradas: Fluws como un paso más.',
    els: [...IN_EDGES, ...IN_RINGS, { c: JOIN, r: 26 }, { d: OUT }, ACTION],
  },
  {
    id: 'n4',
    label: 'N4 · El hueco es el núcleo',
    note: 'Las entradas mueren antes y la salida arranca después. Espacio negativo.',
    els: [
      { d: 'M68 70C140 70 170 160 232 160' },
      { d: 'M68 160H232' },
      { d: 'M68 250C140 250 170 160 232 160' },
      ...IN_RINGS,
      { d: 'M286 160H400' },
      ACTION,
    ],
  },
  {
    id: 'n5',
    label: 'N5 · Cambio de peso',
    note: 'Entra fino y disperso, sale grueso y solo. La transformación es el calibre.',
    els: [
      { d: 'M68 70C140 70 170 160 250 160', w: 13 },
      { d: 'M68 160H250', w: 13 },
      { d: 'M68 250C140 250 170 160 250 160', w: 13 },
      { c: [46, 70], r: 20, w: 13 },
      { c: [46, 160], r: 20, w: 13 },
      { c: [46, 250], r: 20, w: 13 },
      { d: OUT, w: 26 },
      ACTION,
    ],
  },
  {
    id: 'n6',
    label: 'N6 · Salida en flecha',
    note: 'La acción como dirección y no como destino. Más verbo, menos objeto.',
    els: [...IN_EDGES, ...IN_RINGS, { d: 'M250 160H408' }, { d: 'M372 122L410 160L372 198' }],
  },
  {
    id: 'n7',
    label: 'N7 · Dos entradas',
    note: 'La conversación es de a dos. Y aguanta mucho mejor los tamaños chicos.',
    els: [
      { d: 'M68 100C140 100 170 160 250 160' },
      { d: 'M68 220C140 220 170 160 250 160' },
      { c: [46, 100], r: 22 },
      { c: [46, 220], r: 22 },
      { d: OUT },
      ACTION,
    ],
  },
  {
    id: 'n8',
    label: 'N8 · Jerarquía',
    note: 'Entradas chicas, acción grande. El resultado pesa más que los insumos.',
    els: [
      { d: 'M60 82C140 82 170 160 250 160' },
      { d: 'M60 160H250' },
      { d: 'M60 238C140 238 170 160 250 160' },
      { c: [42, 82], r: 16 },
      { c: [42, 160], r: 16 },
      { c: [42, 238], r: 16 },
      { d: OUT },
      { c: [420, 160], r: 38, solid: true },
    ],
  },
];

const glyph = (v, color) =>
  v.els
    .map((el) => {
      const w = el.w ?? STROKE;
      const common = `stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
      return el.d
        ? `<path d="${el.d}" ${common} fill="none"/>`
        : `<circle cx="${el.c[0]}" cy="${el.c[1]}" r="${el.r}" ${common} fill="${el.solid ? color : 'none'}"/>`;
    })
    .join('');

/* Ícono de app. Sin el rombo el símbolo es más compacto, así que entra bastante
   mejor en el cuadrado que la versión anterior. */
const appIcon = (v, bg, fg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="115" fill="${bg}"/>
    <svg x="52" y="52" width="408" height="408" viewBox="${VIEWBOX}">${glyph(v, fg)}</svg>
  </svg>`;

const CELL_W = 580;
const CELL_H = 452;
const COLS = 4;
const FONT = 'Segoe UI, Arial, sans-serif';

/** SVG no reflowea texto: sin esto la nota se sale de la tarjeta. */
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
  const rows = Math.ceil(VARIANTS.length / COLS);
  const W = COLS * CELL_W;
  const H = rows * CELL_H + 110;

  const cells = VARIANTS.map((v, i) => {
    const x = (i % COLS) * CELL_W;
    const y = Math.floor(i / COLS) * CELL_H + 110;
    return `
    <g transform="translate(${x} ${y})">
      <rect x="20" y="14" width="${CELL_W - 40}" height="${CELL_H - 38}" rx="26"
            fill="#11161D" stroke="#1E2630" stroke-width="2"/>

      <svg x="56" y="44" width="468" height="264" viewBox="${VIEWBOX}">${glyph(v, BRAND)}</svg>

      <!-- Pruebas: chico, icono oscuro, icono verde -->
      <svg x="52" y="318" width="124" height="70" viewBox="${VIEWBOX}">${glyph(v, BRAND)}</svg>
      <svg x="196" y="320" width="64" height="64" viewBox="0 0 512 512">${appIcon(v, INK, BRAND)}</svg>
      <svg x="270" y="320" width="64" height="64" viewBox="0 0 512 512">${appIcon(v, BRAND, WHITE)}</svg>

      <text x="352" y="348" font-family="${FONT}" font-size="25" font-weight="600" fill="${WHITE}">${v.label.split(' · ')[0]}</text>
      <text x="352" y="376" font-family="${FONT}" font-size="19" fill="#7C8896">${v.label.split(' · ')[1]}</text>

      ${wrap(v.note, 58)
        .map(
          (line, n) =>
            `<text x="52" y="${414 + n * 25}" font-family="${FONT}" font-size="19" fill="#7C8896">${line}</text>`
        )
        .join('')}
    </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <text x="46" y="58" font-family="${FONT}" font-size="34" font-weight="700" fill="${WHITE}">fluws — muchos a uno, sin rombo</text>
    <text x="46" y="90" font-family="${FONT}" font-size="22" fill="#7C8896">Sin el rombo, la transformación está en la convergencia. Todas se juegan en qué pasa (o qué falta) en el cruce.</text>
    ${cells}
  </svg>`;
}

(async () => {
  const outDir = process.argv[2] || 'scripts/out';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'simbolo-muchos-a-uno.png');
  await sharp(Buffer.from(sheet())).png().toFile(file);
  console.log('listo →', path.resolve(file));
})();
