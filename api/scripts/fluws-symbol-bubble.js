/* Síntesis: la burbuja de asis + el lenguaje de nodos de fluws.
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/fluws-symbol-bubble.js [carpeta]

   El punto de partida es que las dos marcas comparten composición sin saberlo:
   el brand board de fluws es TERMINAL → NÚCLEO → TERMINAL, y la burbuja de asis
   puede ocupar ese núcleo. Todo lo que sigue explora esa unión.

   Lo que se conserva de asis: la silueta de burbuja de chat y el cuadrado
   redondeado del ícono.
   Lo que se toma de fluws: trazo en vez de macizo, anillos como terminales,
   color plano #18C7A5 y fondo #0B0F14.

   Espacio común de 512. Trazo 32 (≈6% del ancho, la misma proporción que venía
   usando el símbolo de fluws). */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BRAND = '#18C7A5';
const INK = '#0B0F14';
const WHITE = '#FFFFFF';
const GRAY = '#7C8896';

const STROKE = 32;
const VIEWBOX = '0 0 512 512';

/** Burbuja de chat en trazo, con cola abajo a la izquierda. Es la silueta de
 *  asis: rectángulo redondeado + pico. */
const bubble = (x1, y1, x2, y2, r, tailX) =>
  `M${x1 + r} ${y1}H${x2 - r}A${r} ${r} 0 0 1 ${x2} ${y1 + r}V${y2 - r}A${r} ${r} 0 0 1 ${x2 - r} ${y2}` +
  `H${tailX + 44}L${tailX} ${y2 + 42}V${y2}H${x1 + r}A${r} ${r} 0 0 1 ${x1} ${y2 - r}V${y1 + r}A${r} ${r} 0 0 1 ${x1 + r} ${y1}Z`;

const BUBBLE_CORE = bubble(146, 132, 366, 316, 46, 206);
const BUBBLE_BIG = bubble(96, 108, 416, 340, 56, 178);

const CONCEPTS = [
  {
    id: 'a',
    label: 'A · La burbuja es el núcleo',
    note: 'La composición del brand board, con la burbuja donde estaba el rombo. Lo que Fluws transforma es, literalmente, la conversación.',
    els: [
      { c: [56, 224], r: 30 },
      { d: 'M86 224H146' },
      { d: BUBBLE_CORE },
      { d: 'M366 224H426' },
      { c: [456, 224], r: 30 },
    ],
  },
  {
    id: 'b',
    label: 'B · El rombo con cola',
    note: 'La edición mínima sobre el arte de fluws: un pico y el núcleo pasa a ser una burbuja. Nodo y conversación en la misma forma.',
    els: [
      { c: [56, 236], r: 30 },
      { d: 'M86 236H130' },
      { d: 'M130 236L256 140L382 236L256 332Z' },
      { d: 'M238 318L200 372' },
      { d: 'M382 236H426' },
      { c: [456, 236], r: 30 },
    ],
  },
  {
    id: 'c',
    label: 'C · El flujo adentro',
    note: 'La burbuja de asis intacta; adentro, donde iban los dos renglones, va el flujo. El más continuista de todos.',
    els: [
      { d: BUBBLE_BIG },
      { c: [176, 196], r: 20 },
      { d: 'M196 196H288' },
      { c: [308, 196], r: 20 },
      { d: 'M176 268H320' },
    ],
  },
  {
    id: 'd',
    label: 'D · La convergencia adentro',
    note: 'Muchos a uno dentro de la burbuja. Dice todo, pero es la que más riesgo corre de empastarse en chico.',
    els: [
      { d: BUBBLE_BIG },
      { c: [172, 168], r: 17 },
      { c: [172, 224], r: 17 },
      { c: [172, 280], r: 17 },
      { d: 'M189 168C224 168 252 200 276 224' },
      { d: 'M189 224H276' },
      { d: 'M189 280C224 280 252 248 276 224' },
      { c: [296, 224], r: 20 },
    ],
  },
  {
    id: 'e',
    label: 'E · Dos burbujas, un nodo',
    note: 'La conversación es de a dos y termina en una acción. Sin núcleo: la transformación es la convergencia.',
    els: [
      { d: bubble(52, 96, 216, 216, 34, 96), w: 26 },
      { d: bubble(52, 288, 216, 408, 34, 96), w: 26 },
      { d: 'M216 156C300 156 320 256 380 256' },
      { d: 'M216 348C300 348 320 256 380 256' },
      { c: [412, 256], r: 32 },
    ],
  },
  {
    id: 'f',
    label: 'F · La cola es el flujo',
    note: 'El pico de la burbuja deja de ser un adorno y se convierte en el flujo que sale hacia la acción.',
    els: [
      { d: bubble(96, 96, 400, 288, 52, 168), w: 32 },
      { d: 'M168 330C168 372 208 396 262 396H352' },
      { c: [384, 396], r: 30 },
    ],
  },
];

const glyph = (c, color) =>
  c.els
    .map((el) => {
      const w = el.w ?? STROKE;
      const common = `stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
      return el.d
        ? `<path d="${el.d}" ${common} fill="none"/>`
        : `<circle cx="${el.c[0]}" cy="${el.c[1]}" r="${el.r}" ${common} fill="none"/>`;
    })
    .join('');

/* Ícono de app. La versión verde con glifo blanco es la que hereda de asis:
   ese era exactamente su ícono (cuadrado teal, burbuja blanca). */
const appIcon = (c, bg, fg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="115" fill="${bg}"/>
    <svg x="76" y="76" width="360" height="360" viewBox="${VIEWBOX}">${glyph(c, fg)}</svg>
  </svg>`;

const CELL_W = 620;
const CELL_H = 560;
const COLS = 3;
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
  const rows = Math.ceil(CONCEPTS.length / COLS);
  const W = COLS * CELL_W;
  const H = rows * CELL_H + 120;

  const cells = CONCEPTS.map((c, i) => {
    const x = (i % COLS) * CELL_W;
    const y = Math.floor(i / COLS) * CELL_H + 120;
    return `
    <g transform="translate(${x} ${y})">
      <rect x="20" y="14" width="${CELL_W - 40}" height="${CELL_H - 40}" rx="26"
            fill="#11161D" stroke="#1E2630" stroke-width="2"/>

      <svg x="150" y="44" width="330" height="330" viewBox="${VIEWBOX}">${glyph(c, BRAND)}</svg>

      <!-- Pruebas: chico, icono oscuro, icono verde (el heredado de asis) -->
      <svg x="56" y="392" width="74" height="74" viewBox="${VIEWBOX}">${glyph(c, BRAND)}</svg>
      <svg x="146" y="392" width="74" height="74" viewBox="0 0 512 512">${appIcon(c, INK, BRAND)}</svg>
      <svg x="236" y="392" width="74" height="74" viewBox="0 0 512 512">${appIcon(c, BRAND, WHITE)}</svg>
      <svg x="330" y="404" width="50" height="50" viewBox="${VIEWBOX}">${glyph(c, BRAND)}</svg>
      <svg x="392" y="414" width="30" height="30" viewBox="${VIEWBOX}">${glyph(c, BRAND)}</svg>

      <text x="56" y="504" font-family="${FONT}" font-size="25" font-weight="600" fill="${WHITE}">${c.label}</text>
      ${wrap(c.note, 62)
        .map(
          (line, n) =>
            `<text x="56" y="${534 + n * 24}" font-family="${FONT}" font-size="18" fill="${GRAY}">${line}</text>`
        )
        .join('')}
    </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <text x="46" y="60" font-family="${FONT}" font-size="34" font-weight="700" fill="${WHITE}">la burbuja de asis × el lenguaje de fluws</text>
    <text x="46" y="94" font-family="${FONT}" font-size="21" fill="${GRAY}">Las dos marcas comparten composición: terminal → núcleo → terminal. La burbuja puede ocupar ese núcleo.</text>
    ${cells}
  </svg>`;
}

(async () => {
  const outDir = process.argv[2] || 'scripts/out';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'simbolo-burbuja.png');
  await sharp(Buffer.from(sheet())).png().toFile(file);
  console.log('listo →', path.resolve(file));
})();
