/* fluws: la regla de la anomalía.
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/fluws-symbol-anomaly.js [carpeta]

   EL PRINCIPIO. "fluws" es "flows" con una letra cambiada: casi la palabra
   esperada, pero no. El dominio estaba libre por esa desviación mínima. La
   traducción visual es tomar una forma telecom que todo el mundo reconoce y
   romperla en UN SOLO lugar, deliberadamente, dejando todo lo demás intacto.

   Esto resuelve el problema de la tanda anterior: aquellas estaban bien
   dirigidas pero eran formas de catálogo — barras de señal, órbitas, ondas —
   que cualquier competidor emergente puede tener. La anomalía es lo que no se
   puede copiar sin que se note que te copió.

   Regla de ejecución: la anomalía tiene que ser UNA sola y tiene que verse a
   16px. Dos anomalías leen como desprolijidad, no como decisión.

   Descartado y por qué: burbuja (literal, y de Intercom), horquilla (glifo de
   compartir), monograma "f" (Facebook, y mudo), barras de señal limpias (es el
   ícono de la barra de estado del teléfono), abanico de arcos (wifi y RSS). */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BRAND = '#18C7A5';
const INK = '#0B0F14';
const WHITE = '#FFFFFF';
const GRAY = '#7C8896';

const VIEWBOX = '0 0 512 512';
const bar = (x, y, w, h, c) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2}" fill="${c}"/>`;

const INTERIORS = [
  {
    id: 'a',
    label: 'A · Órbita descentrada',
    idea: 'La órbita no gira alrededor del núcleo: está corrida. Roza de un lado y se abre del otro.',
    render: (c) =>
      `<path d="M292 122A138 138 0 1 1 154 260" fill="none" stroke="${c}" stroke-width="44" stroke-linecap="round"/>
       <circle cx="238" cy="256" r="56" fill="${c}"/>`,
  },
  {
    id: 'b',
    label: 'B · La barra que se soltó',
    idea: 'La escalera de señal, con una barra que dejó la línea de base y flota.',
    render: (c) =>
      bar(136, 300, 44, 80, c) + bar(198, 258, 44, 122, c) + bar(260, 172, 44, 164, c) + bar(322, 156, 44, 224, c),
  },
  {
    id: 'c',
    label: 'C · Anillo fuera de registro',
    idea: 'Dos mitades del mismo anillo, una rotada. Las puntas no se encuentran donde deberían.',
    render: (c) =>
      `<g fill="none" stroke="${c}" stroke-width="46" stroke-linecap="round">
         <path d="M126 256A130 130 0 0 1 386 256"/>
         <path d="M126 256A130 130 0 0 0 386 256" transform="rotate(22 256 256)"/>
       </g>`,
  },
  {
    id: 'd',
    label: 'D · La órbita que salta de radio',
    idea: 'Da media vuelta cerca, salta hacia afuera y sigue. Una órbita que no vuelve al mismo lugar.',
    render: (c) =>
      `<path d="M160 256A96 96 0 0 1 352 256L406 256A150 150 0 0 1 106 256" fill="none"
             stroke="${c}" stroke-width="44" stroke-linecap="round"/>`,
  },
  {
    id: 'e',
    label: 'E · El que no es como los otros',
    idea: 'La traducción más literal del nombre: tres iguales y uno sustituido.',
    render: (c) =>
      `<circle cx="196" cy="192" r="46" fill="${c}"/>
       <circle cx="318" cy="192" r="46" fill="${c}"/>
       <circle cx="196" cy="314" r="46" fill="${c}"/>
       ${bar(272, 268, 92, 92, c)}`,
  },
  {
    id: 'f',
    label: 'F · El punto que se salió',
    idea: 'La órbita cerrada y un nodo que ya no está en ella. Escapó y sigue ahí.',
    render: (c) =>
      `<circle cx="240" cy="272" r="122" fill="none" stroke="${c}" stroke-width="46"/>
       <circle cx="386" cy="132" r="48" fill="${c}"/>`,
  },
  {
    id: 'g',
    label: 'G · Órbitas a distinto eje',
    idea: 'Dos canales alrededor del mismo núcleo, sin simetría: distinto radio y distinto ángulo.',
    render: (c) =>
      `<circle cx="256" cy="256" r="48" fill="${c}"/>
       <g fill="none" stroke="${c}" stroke-linecap="round">
         <path d="M330 148A140 140 0 0 1 366 302" stroke-width="42"/>
         <path d="M186 372A106 106 0 0 1 156 214" stroke-width="34"/>
       </g>`,
  },
  {
    id: 'h',
    label: 'H · El foco corrido',
    idea: 'Los arcos de emisión son concéntricos, pero la fuente no está en su centro.',
    render: (c) =>
      `<g fill="none" stroke="${c}" stroke-linecap="round">
         <path d="M244 184A92 92 0 0 1 244 328" stroke-width="38"/>
         <path d="M288 130A156 156 0 0 1 288 382" stroke-width="44"/>
       </g>
       <circle cx="176" cy="190" r="48" fill="${c}"/>`,
  },
  {
    id: 'i',
    label: 'I · El que giró',
    idea: 'Cuatro barras del mismo sistema; una tomó otro eje. El cuarto de vuelta, como anomalía.',
    render: (c) =>
      bar(130, 170, 150, 42, c) + bar(130, 236, 150, 42, c) + bar(130, 302, 150, 42, c) +
      bar(322, 150, 42, 214, c),
  },
];

const icon = (it, bg, fg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">
     <rect width="512" height="512" rx="115" fill="${bg}"/>
     ${it.render(fg)}
   </svg>`;

const CELL_W = 560;
const CELL_H = 530;
const COLS = 3;
const FONT = 'Segoe UI, Arial, sans-serif';

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
  const rows = Math.ceil(INTERIORS.length / COLS);
  const W = COLS * CELL_W;
  const H = rows * CELL_H + 140;

  const cells = INTERIORS.map((it, i) => {
    const x = (i % COLS) * CELL_W;
    const y = Math.floor(i / COLS) * CELL_H + 140;
    return `
    <g transform="translate(${x} ${y})">
      <rect x="20" y="14" width="${CELL_W - 40}" height="${CELL_H - 40}" rx="26"
            fill="#11161D" stroke="#1E2630" stroke-width="2"/>

      <svg x="150" y="42" width="260" height="260">${icon(it, BRAND, WHITE)}</svg>

      <svg x="56" y="326" width="48" height="48">${icon(it, BRAND, WHITE)}</svg>
      <svg x="120" y="334" width="32" height="32">${icon(it, BRAND, WHITE)}</svg>
      <svg x="168" y="338" width="24" height="24">${icon(it, BRAND, WHITE)}</svg>
      <svg x="208" y="342" width="16" height="16">${icon(it, BRAND, WHITE)}</svg>
      <svg x="248" y="326" width="48" height="48">${icon(it, INK, BRAND)}</svg>

      <text x="56" y="416" font-family="${FONT}" font-size="24" font-weight="600" fill="${WHITE}">${it.label}</text>
      ${wrap(it.idea, 56)
        .map(
          (line, n) =>
            `<text x="56" y="${446 + n * 24}" font-family="${FONT}" font-size="18" fill="${GRAY}">${line}</text>`
        )
        .join('')}
    </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <text x="46" y="58" font-family="${FONT}" font-size="34" font-weight="700" fill="${WHITE}">fluws — la regla de la anomalía</text>
    <text x="46" y="94" font-family="${FONT}" font-size="21" fill="${GRAY}">"fluws" es "flows" con una letra cambiada. Estas son formas telecom conocidas, rotas en un solo lugar a propósito.</text>
    <text x="46" y="124" font-family="${FONT}" font-size="19" fill="${GRAY}">Una anomalía sola, y que se vea a 16px. Dos anomalías leen como desprolijidad, no como decisión.</text>
    ${cells}
  </svg>`;
}

(async () => {
  const outDir = process.argv[2] || 'scripts/out';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'simbolo-anomalia.png');
  await sharp(Buffer.from(sheet())).png().toFile(file);
  console.log('listo →', path.resolve(file));
})();
