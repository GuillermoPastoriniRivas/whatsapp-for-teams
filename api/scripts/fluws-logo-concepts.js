/* Hoja de contacto con direcciones alternativas para el logo de Fluws.
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/fluws-logo-concepts.js <carpeta-de-salida>

   Cada concepto se dibuja en el mismo espacio de 512 y con el mismo degradado,
   para que la comparación sea entre ideas y no entre encuadres. Cada celda
   muestra el glifo grande, el mismo glifo a 34px (prueba de legibilidad, que es
   donde se caen la mitad de las ideas) y el cuadrado de ícono de app. */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const TEAL_DARK = '#0FA292';
const TEAL_MID = '#23C7A6';
const TEAL_LIGHT = '#4AE4BC';
const NAVY = '#101A2B';

/* type: 'stroke' se pinta con el color como trazo; 'fill', como relleno. */
const CONCEPTS = [
  {
    id: 'horquilla',
    label: 'A · La horquilla (la actual)',
    note: 'Un tallo que se abre en dos ramas.',
    stroke: 62,
    els: [
      { type: 'stroke', d: 'M116 256H272' },
      { type: 'stroke', d: 'M272 256C304 256 336 212 396 152' },
      { type: 'stroke', d: 'M272 256C304 256 336 300 396 360' },
    ],
  },
  {
    id: 'nodos',
    label: 'B · Nodos',
    note: 'El grafo explícito: un paso que dispara dos.',
    stroke: 40,
    els: [
      { type: 'stroke', d: 'M186 256C248 256 262 178 330 162' },
      { type: 'stroke', d: 'M186 256C248 256 262 334 330 350' },
      { type: 'circle', cx: 136, cy: 256, r: 50 },
      { type: 'circle', cx: 374, cy: 154, r: 44 },
      { type: 'circle', cx: 374, cy: 358, r: 44 },
    ],
  },
  {
    id: 'corriente',
    label: 'C · La corriente',
    note: 'Ondas que también leen como renglones de un mensaje.',
    stroke: 54,
    els: [
      { type: 'stroke', d: 'M120 170C196 122 276 218 392 170' },
      { type: 'stroke', d: 'M120 256C196 208 276 304 392 256' },
      { type: 'stroke', d: 'M120 342C186 294 250 380 330 348' },
    ],
  },
  {
    id: 'onda',
    label: 'D · La onda',
    note: 'Un ciclo de seno: fluir, sin decir nada más.',
    stroke: 64,
    // Sube y baja: un ciclo completo. Una sola joroba lee como arco, no como onda.
    els: [
      { type: 'stroke', d: 'M96 256C136 160 216 160 256 256C296 352 376 352 416 256' },
    ],
  },
  {
    id: 'vias',
    label: 'E · Las vías',
    note: 'Dos carriles que corren juntos y se separan. Fluws, en plural.',
    stroke: 46,
    els: [
      { type: 'stroke', d: 'M104 226H250C320 226 340 180 404 152' },
      { type: 'stroke', d: 'M104 286H250C320 286 340 332 404 360' },
    ],
  },
  {
    id: 'burbuja',
    label: 'F · La horquilla en la burbuja',
    note: 'Guarda el ADN de chat del logo viejo y le mete el flujo adentro.',
    stroke: 44,
    els: [
      {
        type: 'stroke',
        d: 'M166 118H346A56 56 0 0 1 402 174V274A56 56 0 0 1 346 330H262L214 376V330H166A56 56 0 0 1 110 274V174A56 56 0 0 1 166 118Z',
      },
      // La horquilla al 42% y centrada en el cuerpo de la burbuja (256, 224).
      {
        type: 'group',
        transform: 'translate(256 224) scale(0.42) translate(-258 -256)',
        els: [
          { type: 'stroke', d: 'M116 256H272' },
          { type: 'stroke', d: 'M272 256C304 256 336 212 396 152' },
          { type: 'stroke', d: 'M272 256C304 256 336 300 396 360' },
        ],
      },
    ],
  },
];

const paint = (els, color) =>
  els
    .map((el) =>
      el.type === 'circle'
        ? `<circle cx="${el.cx}" cy="${el.cy}" r="${el.r}" fill="${color}"/>`
        : el.type === 'fill'
          ? `<path d="${el.d}" fill="${color}"/>`
          : el.type === 'group'
            ? `<g transform="${el.transform}">${paint(el.els, color)}</g>`
            : `<path d="${el.d}" stroke="${color}" fill="none"/>`
    )
    .join('');

const glyph = (c, color, gid) =>
  `<g stroke-width="${c.stroke}" stroke-linecap="round" stroke-linejoin="round">${paint(c.els, color ?? `url(#${gid})`)}</g>`;

const CELL_W = 560;
const CELL_H = 620;
const COLS = 3;

function sheet() {
  const rows = Math.ceil(CONCEPTS.length / COLS);
  const W = COLS * CELL_W;
  const H = rows * CELL_H + 90;

  const defs = CONCEPTS.map(
    (c) => `
    <linearGradient id="g-${c.id}" x1="0" y1="0.6" x2="1" y2="0.25">
      <stop offset="0" stop-color="${TEAL_DARK}"/>
      <stop offset="0.5" stop-color="${TEAL_MID}"/>
      <stop offset="1" stop-color="${TEAL_LIGHT}"/>
    </linearGradient>
    <linearGradient id="i-${c.id}" x1="0" y1="0" x2="1" y2="0.72">
      <stop offset="0" stop-color="${TEAL_LIGHT}"/>
      <stop offset="1" stop-color="${TEAL_DARK}"/>
    </linearGradient>`
  ).join('');

  const cells = CONCEPTS.map((c, i) => {
    const x = (i % COLS) * CELL_W;
    const y = Math.floor(i / COLS) * CELL_H + 90;
    return `
    <g transform="translate(${x} ${y})">
      <rect x="24" y="16" width="${CELL_W - 48}" height="${CELL_H - 40}" rx="28"
            fill="#ffffff" stroke="#E4E9EF" stroke-width="2"/>

      <!-- Glifo grande -->
      <svg x="120" y="48" width="320" height="320" viewBox="0 0 512 512">${glyph(c, null, `g-${c.id}`)}</svg>

      <!-- Fila de pruebas: 34px, 34px monocromo sobre navy, y el icono de app -->
      <svg x="152" y="388" width="34" height="34" viewBox="0 0 512 512">${glyph(c, null, `g-${c.id}`)}</svg>

      <rect x="206" y="382" width="46" height="46" rx="10" fill="${NAVY}"/>
      <svg x="212" y="388" width="34" height="34" viewBox="0 0 512 512">${glyph(c, '#ffffff')}</svg>

      <rect x="272" y="376" width="58" height="58" rx="13" fill="url(#i-${c.id})"/>
      <svg x="280" y="384" width="42" height="42" viewBox="0 0 512 512">
        <g transform="translate(256 256) scale(0.74) translate(-256 -256)">${glyph(c, '#ffffff')}</g>
      </svg>

      <!-- Lockup con el wordmark -->
      <svg x="346" y="386" width="38" height="38" viewBox="0 0 512 512">${glyph(c, null, `g-${c.id}`)}</svg>
      <text x="390" y="415" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="700" fill="${NAVY}">Fluws</text>

      <text x="60" y="492" font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="700" fill="${NAVY}">${c.label}</text>
      <text x="60" y="530" font-family="Segoe UI, Arial, sans-serif" font-size="23" fill="#5A6472">${c.note}</text>
    </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>${defs}</defs>
    <rect width="${W}" height="${H}" fill="#F4F6F9"/>
    <text x="48" y="62" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="${NAVY}">Fluws — direcciones de logo</text>
    ${cells}
  </svg>`;
}

(async () => {
  const outDir = process.argv[2] || 'scripts/out';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'conceptos.png');
  await sharp(Buffer.from(sheet())).png().toFile(file);
  console.log('listo →', path.resolve(file));
})();
