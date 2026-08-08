/* Cuánto separa a fluws de Flow (Telecom Argentina), palanca por palanca.
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/fluws-vs-flow.js [carpeta]

   EL PROBLEMA. Flow usa verde turquesa y un isotipo circular. fluws usa verde
   turquesa y un anillo con núcleo. Colisión de color, de forma y de país al
   mismo tiempo, y encima el rubro de Flow es literalmente telecomunicaciones.

   La referencia de Flow es una RECONSTRUCCIÓN aproximada a partir del favicon,
   solo para comparar siluetas a tamaño de pestaña. No es su arte.

   Lo que se mide acá: a tamaño de pestaña el ojo registra primero el COLOR,
   después la silueta y último el detalle. Por eso las palancas de color van
   separadas de las de forma. */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ORBIT = 'M304.6 122.6A142 142 0 1 1 207.4 122.6';
const TAIL = 'M185.6 388.4L84.8 421.3L123.6 326.4Z';

const BRAND = '#18C7A5';
const INK = '#0B0F14';
const WHITE = '#FFFFFF';
const GRAY = '#7C8896';

/** El símbolo actual, parametrizado en lo que se va a mover. */
function glyph({
  color = BRAND,
  orbit = ORBIT,
  tail = TAIL,
  tailStroke = 18,
  core = '<circle cx="256" cy="256" r="54"/>',
} = {}) {
  return (
    `<path d="${orbit}" fill="none" stroke="${color}" stroke-width="46" stroke-linecap="round"/>` +
    (tail
      ? `<path d="${tail}" fill="${color}" stroke="${color}" stroke-width="${tailStroke}" stroke-linejoin="round"/>`
      : '') +
    core.replace('<circle', `<circle fill="${color}"`).replace('<rect', `<rect fill="${color}"`)
  );
}

/* Reconstrucción aproximada del isotipo de Flow: anillo turquesa con núcleo
   macizo, sin patita y sin boca. */
const FLOW_TURQUOISE = '#00BFA9';
const flowMark = () =>
  `<circle cx="256" cy="256" r="150" fill="none" stroke="${FLOW_TURQUOISE}" stroke-width="52"/>` +
  `<circle cx="256" cy="256" r="60" fill="${FLOW_TURQUOISE}"/>`;

const OPTIONS = [
  {
    id: 'flow',
    label: 'Flow (referencia)',
    note: 'Anillo turquesa con núcleo. Reconstrucción aproximada.',
    inner: flowMark,
  },
  {
    id: 'actual',
    label: 'fluws, hoy',
    note: 'Mismo color, misma familia de forma. Acá está el problema.',
    inner: () => glyph(),
  },
  {
    id: 'patita',
    label: 'Patita más grande',
    note: 'Palanca de silueta: la patita es lo único que Flow no tiene.',
    inner: () => glyph({ tail: 'M182 396L54 438L112 318Z', tailStroke: 22 }),
  },
  {
    id: 'boca',
    label: 'Boca mucho más abierta',
    note: 'De 320° a 250°: deja de leer como círculo cerrado.',
    inner: () =>
      glyph({ orbit: 'M348.7 175.3A142 142 0 1 1 163.3 175.3' }),
  },
  {
    id: 'nucleo',
    label: 'Núcleo cuadrado',
    note: 'Rompe la rima círculo-dentro-de-círculo, que es lo que más se parece.',
    inner: () =>
      glyph({ core: '<rect x="204" y="204" width="104" height="104" rx="30"/>' }),
  },
  {
    id: 'lima',
    label: 'Verde lima',
    note: 'Palanca de color: se va del turquesa hacia el amarillo.',
    inner: () => glyph({ color: '#3ED47A' }),
  },
  {
    id: 'profundo',
    label: 'Verde profundo',
    note: 'Mismo tono, mucho más oscuro. Conserva el aire de asis.',
    inner: () => glyph({ color: '#0A8F7A' }),
  },
  {
    id: 'indigo',
    label: 'Índigo',
    note: 'Ruptura total. Se pierde la herencia verde de asis y de WhatsApp.',
    inner: () => glyph({ color: '#6C5CE7' }),
  },
];

/* Al favicon lo escala 1.35 y lo recentra en el bbox real, que no está en el
   centro del lienzo porque la patita corre el peso. La referencia de Flow es
   simétrica y no necesita el recentrado. */
const asFavicon = (o) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
  (o.id === 'flow'
    ? o.inner()
    : `<g transform="translate(256 256) scale(1.35) translate(-248.4 -264.95)">${o.inner()}</g>`) +
  `</svg>`;

const CELL_W = 470;
const CELL_H = 300;
const COLS = 4;
const FONT = 'Segoe UI, Arial, sans-serif';

function wrap(text, max) {
  const lines = [''];
  for (const w of text.split(' ')) {
    const l = lines[lines.length - 1];
    if (l && (l + ' ' + w).length > max) lines.push(w);
    else lines[lines.length - 1] = l ? l + ' ' + w : w;
  }
  return lines;
}

function sheet() {
  const rows = Math.ceil(OPTIONS.length / COLS);
  const W = COLS * CELL_W;
  const H = rows * CELL_H + 130;

  const cells = OPTIONS.map((o, i) => {
    const x = (i % COLS) * CELL_W;
    const y = Math.floor(i / COLS) * CELL_H + 130;
    const fav = asFavicon(o);
    // Tamaños de pestaña reales, sobre claro y sobre oscuro.
    const strip = (bg, oy) =>
      `<rect x="40" y="${oy}" width="${CELL_W - 80}" height="62" rx="12" fill="${bg}"/>` +
      [48, 32, 24, 16]
        .map((px, n) => `<svg x="${64 + n * 78}" y="${oy + 31 - px / 2}" width="${px}" height="${px}">${fav}</svg>`)
        .join('');
    return `
    <g transform="translate(${x} ${y})">
      <rect x="20" y="10" width="${CELL_W - 40}" height="${CELL_H - 34}" rx="22"
            fill="#11161D" stroke="#1E2630" stroke-width="2"/>
      ${strip('#FFFFFF', 34)}
      ${strip('#202124', 108)}
      <text x="40" y="212" font-family="${FONT}" font-size="22" font-weight="600" fill="${WHITE}">${o.label}</text>
      ${wrap(o.note, 46)
        .map((l, n) => `<text x="40" y="${240 + n * 22}" font-family="${FONT}" font-size="17" fill="${GRAY}">${l}</text>`)
        .join('')}
    </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <text x="40" y="54" font-family="${FONT}" font-size="32" font-weight="700" fill="${WHITE}">fluws vs Flow — qué palanca separa de verdad</text>
    <text x="40" y="88" font-family="${FONT}" font-size="20" fill="${GRAY}">Cada opción a 48 · 32 · 24 · 16px, sobre barra clara y sobre barra oscura, que es donde se ve el problema.</text>
    <text x="40" y="116" font-family="${FONT}" font-size="18" fill="${GRAY}">A tamaño de pestaña el ojo registra primero el color, después la silueta y último el detalle.</text>
    ${cells}
  </svg>`;
}

(async () => {
  const outDir = process.argv[2] || 'scripts/out';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'fluws-vs-flow.png');
  await sharp(Buffer.from(sheet())).png().toFile(file);
  console.log('listo →', path.resolve(file));
})();
