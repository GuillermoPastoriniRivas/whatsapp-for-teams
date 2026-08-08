/* fluws: el ganador (Órbita 320°) con y sin patita de burbuja.
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/fluws-symbol-tail.js [carpeta]

   El símbolo elegido es núcleo macizo + órbita de 320°, con la boca arriba.
   Esta hoja existe para sacarse una duda: si sumarle una patita de burbuja de
   chat le suma o le resta.

   Cuatro tratamientos, porque "estilo burbuja" no es una sola cosa:
   maciza pegada al anillo, de trazo continuando el anillo, integrada en la
   boca del arco (rotando la abertura hacia abajo-izquierda), y abajo al
   centro, que es la posición canónica del globo de diálogo. */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BRAND = '#18C7A5';
const INK = '#0B0F14';
const WHITE = '#FFFFFF';
const GRAY = '#7C8896';

const VIEWBOX = '0 0 512 512';
const C = 256;
const R_ORBIT = 142;
const W_ORBIT = 46;
const R_CORE = 54;

const f = (n) => n.toFixed(1);
const P = (deg, r) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)];
const pt = ([x, y]) => `${f(x)} ${f(y)}`;

/** Arco por ángulos en grados; en coordenadas SVG el ángulo crece hacia abajo. */
function arc(r, degFrom, degTo) {
  const large = Math.abs(degTo - degFrom) > 180 ? 1 : 0;
  return `M${pt(P(degFrom, r))}A${r} ${r} 0 ${large} 1 ${pt(P(degTo, r))}`;
}

const core = (c) => `<circle cx="${C}" cy="${C}" r="${R_CORE}" fill="${c}"/>`;
const orbit = (c, from = -70, to = 250) =>
  `<path d="${arc(R_ORBIT, from, to)}" fill="none" stroke="${c}" stroke-width="${W_ORBIT}" stroke-linecap="round"/>`;

/**
 * Patita maciza. La base se apoya sobre la banda del trazo del anillo (radio
 * entre 119 y 165) para que quede fundida con él, y la punta sale afuera.
 * Se dibuja con `stroke-linejoin="round"` y trazo del mismo color: es la forma
 * más simple de redondearle las esquinas a un triángulo en SVG.
 */
const tail = (c, baseA, baseB, tipDeg, tipR) =>
  `<path d="M${pt(P(baseA, 150))}L${pt(P(tipDeg, tipR))}L${pt(P(baseB, 150))}Z"
         fill="${c}" stroke="${c}" stroke-width="18" stroke-linejoin="round"/>`;

const VARIANTS = [
  {
    id: 'ref',
    label: 'REF · El ganador, sin tocar',
    idea: 'Núcleo macizo y órbita de 320° con la boca arriba. Es el que elegiste.',
    render: (c) => core(c) + orbit(c),
  },
  {
    id: 'v1',
    label: 'V1 · Patita maciza',
    idea: 'Triángulo redondeado apoyado sobre la banda del anillo, abajo a la izquierda.',
    render: (c) => core(c) + orbit(c) + tail(c, 118, 152, 136, 238),
  },
  {
    id: 'v2',
    label: 'V2 · Patita de trazo',
    idea: 'La patita es un trazo del mismo grosor que la órbita. Más coherente, menos "globo".',
    render: (c) =>
      core(c) + orbit(c) +
      `<path d="M${pt(P(136, 150))}L${pt(P(140, 232))}" fill="none" stroke="${c}"
             stroke-width="${W_ORBIT}" stroke-linecap="round"/>`,
  },
  {
    id: 'v3',
    label: 'V3 · Integrada en la boca',
    idea: 'La abertura del arco baja a la izquierda y una de sus puntas se estira para ser la patita.',
    render: (c) =>
      core(c) + orbit(c, 178, 486) +
      `<path d="M${pt(P(128, 142))}L${pt(P(138, 236))}" fill="none" stroke="${c}"
             stroke-width="${W_ORBIT}" stroke-linecap="round"/>`,
  },
  {
    id: 'v4',
    label: 'V4 · Patita abajo, al centro',
    idea: 'La posición canónica del globo de diálogo, para comparar contra la de la izquierda.',
    render: (c) => core(c) + orbit(c) + tail(c, 74, 106, 90, 236),
  },
];

const icon = (v, bg, fg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">
     <rect width="512" height="512" rx="115" fill="${bg}"/>${v.render(fg)}
   </svg>`;

const CELL_W = 560;
const CELL_H = 520;
const COLS = 5;
const FONT = 'Segoe UI, Arial, sans-serif';

function wrap(text, max) {
  const lines = [''];
  for (const word of text.split(' ')) {
    const l = lines[lines.length - 1];
    if (l && (l + ' ' + word).length > max) lines.push(word);
    else lines[lines.length - 1] = l ? l + ' ' + word : word;
  }
  return lines;
}

function sheet() {
  const W = COLS * CELL_W;
  const H = CELL_H + 140;
  const cells = VARIANTS.map((v, i) => {
    const x = i * CELL_W;
    return `
    <g transform="translate(${x} 140)">
      <rect x="20" y="14" width="${CELL_W - 40}" height="${CELL_H - 40}" rx="26"
            fill="#11161D" stroke="#1E2630" stroke-width="2"/>
      <svg x="150" y="42" width="260" height="260">${icon(v, BRAND, WHITE)}</svg>
      <svg x="56" y="326" width="48" height="48">${icon(v, BRAND, WHITE)}</svg>
      <svg x="120" y="334" width="32" height="32">${icon(v, BRAND, WHITE)}</svg>
      <svg x="168" y="338" width="24" height="24">${icon(v, BRAND, WHITE)}</svg>
      <svg x="208" y="342" width="16" height="16">${icon(v, BRAND, WHITE)}</svg>
      <svg x="248" y="326" width="48" height="48">${icon(v, INK, BRAND)}</svg>
      <text x="56" y="416" font-family="${FONT}" font-size="23" font-weight="600" fill="${WHITE}">${v.label}</text>
      ${wrap(v.idea, 56)
        .map((l, n) => `<text x="56" y="${446 + n * 24}" font-family="${FONT}" font-size="18" fill="${GRAY}">${l}</text>`)
        .join('')}
    </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <text x="46" y="58" font-family="${FONT}" font-size="34" font-weight="700" fill="${WHITE}">fluws — el ganador, con y sin patita</text>
    <text x="46" y="94" font-family="${FONT}" font-size="21" fill="${GRAY}">Cuatro maneras de resolver la patita de burbuja sobre el mismo símbolo, para comparar contra el original.</text>
    <text x="46" y="124" font-family="${FONT}" font-size="19" fill="${GRAY}">Probadas a 48 · 32 · 24 · 16px reales, más la versión oscura para fondo claro.</text>
    ${cells}
  </svg>`;
}

(async () => {
  const outDir = process.argv[2] || 'scripts/out';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'simbolo-patita.png');
  await sharp(Buffer.from(sheet())).png().toFile(file);
  console.log('listo →', path.resolve(file));
})();
