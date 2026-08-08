/* fluws: el cuadrado verde está fijo; esta tanda lleva el interior al registro
   de telecomunicaciones.
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/fluws-symbol-telecom.js [carpeta]

   De la tanda anterior gustaron cuatro: siempre encendido, núcleo en órbita,
   cuarto de vuelta y la respuesta. Tres de las cuatro son ARCOS, que ya es
   vocabulario telecom (emisión, órbita, duplex). La cuarta son barras: si en
   vez de acortarse crecen, dejan de leer como renglones de texto y pasan a
   leer como barras de señal.

   Descartado y por qué, para no reproponerlo: burbuja de chat (literal, y de
   Intercom), horquilla o bifurcación con trazo fino (glifo de compartir, y se
   desintegra abajo de 32px), monograma "f" (Facebook, y encima mudo), rombo
   simétrico (no dice transformación), canales que cortan el cuadrado (destruyen
   la silueta del contenedor).

   Trampa a evitar en este registro: el abanico de arcos saliendo de un punto es
   el ícono de wifi. Acá los arcos salen HORIZONTALES y son dos, no tres, para
   despegarse de eso. */

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
    label: 'A · Emisión',
    idea: 'Un nodo que transmite. Arcos horizontales y solo dos, para no ser el ícono de wifi.',
    render: (c) =>
      `<circle cx="168" cy="256" r="46" fill="${c}"/>
       <g fill="none" stroke="${c}" stroke-linecap="round">
         <path d="M232 190A88 88 0 0 1 232 322" stroke-width="38"/>
         <path d="M276 138A156 156 0 0 1 276 374" stroke-width="44"/>
       </g>`,
  },
  {
    id: 'b',
    label: 'B · Barras de señal',
    idea: 'Intensidad creciente. El código visual más reconocible de telecom.',
    render: (c) =>
      bar(140, 292, 44, 88, c) + bar(202, 252, 44, 128, c) + bar(264, 208, 44, 172, c) + bar(326, 156, 44, 224, c),
  },
  {
    id: 'c',
    label: 'C · La señal se consolida',
    idea: 'El cuarto de vuelta en clave telecom: barras que crecen y terminan en un bloque.',
    render: (c) =>
      bar(132, 300, 42, 80, c) + bar(190, 258, 42, 122, c) + bar(248, 216, 42, 164, c) +
      bar(322, 150, 64, 230, c),
  },
  {
    id: 'd',
    label: 'D · Duplex',
    idea: 'Transmite y recibe: dos arcos enfrentados de peso distinto, con el enlace en el medio.',
    render: (c) =>
      `<g fill="none" stroke="${c}" stroke-linecap="round">
         <path d="M196 164A122 122 0 0 0 196 348" stroke-width="36"/>
         <path d="M316 148A146 146 0 0 1 316 364" stroke-width="64"/>
       </g>
       <circle cx="256" cy="256" r="34" fill="${c}"/>`,
  },
  {
    id: 'e',
    label: 'E · Órbita',
    idea: 'Núcleo estable y una órbita de tres cuartos, para que no lea como una "D".',
    render: (c) =>
      `<circle cx="256" cy="256" r="54" fill="${c}"/>
       <path d="M256 120A136 136 0 1 1 120 256" fill="none" stroke="${c}" stroke-width="46" stroke-linecap="round"/>`,
  },
  {
    id: 'f',
    label: 'F · Doble órbita',
    idea: 'Dos canales girando alrededor del mismo núcleo, en lados opuestos.',
    render: (c) =>
      `<circle cx="256" cy="256" r="44" fill="${c}"/>
       <g fill="none" stroke="${c}" stroke-width="40" stroke-linecap="round">
         <path d="M312 152A130 130 0 0 1 312 360"/>
         <path d="M200 360A130 130 0 0 1 200 152"/>
       </g>`,
  },
  {
    id: 'g',
    label: 'G · Enlace abierto',
    idea: 'El anillo con una boca ancha y el nodo afuera. Puntas rectas, para no ser un spinner.',
    render: (c) =>
      `<path d="M330 168A128 128 0 1 0 356 300" fill="none" stroke="${c}" stroke-width="58"/>
       <circle cx="372" cy="150" r="46" fill="${c}"/>`,
  },
  {
    id: 'h',
    label: 'H · Portadora',
    idea: 'La onda deja de ser decorativa: viaja y llega a un destino.',
    render: (c) =>
      `<path d="M136 256C162 196 214 196 240 256C266 316 318 316 344 256" fill="none"
             stroke="${c}" stroke-width="50" stroke-linecap="round"/>
       <circle cx="376" cy="256" r="34" fill="${c}"/>`,
  },
  {
    id: 'i',
    label: 'I · Central',
    idea: 'Topología estrella: un centro y las líneas que entran. La central telefónica.',
    render: (c) =>
      `<g stroke="${c}" stroke-width="28" stroke-linecap="round">
         <path d="M256 256L146 146"/><path d="M256 256L366 146"/>
         <path d="M256 256L146 366"/><path d="M256 256L366 366"/>
       </g>
       <circle cx="256" cy="256" r="62" fill="${c}"/>
       <circle cx="140" cy="140" r="30" fill="${c}"/>
       <circle cx="372" cy="140" r="30" fill="${c}"/>
       <circle cx="140" cy="372" r="30" fill="${c}"/>
       <circle cx="372" cy="372" r="30" fill="${c}"/>`,
  },
];

const icon = (it, bg, fg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">
     <rect width="512" height="512" rx="115" fill="${bg}"/>
     ${it.render(fg)}
   </svg>`;

const CELL_W = 560;
const CELL_H = 520;
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
  const H = rows * CELL_H + 130;

  const cells = INTERIORS.map((it, i) => {
    const x = (i % COLS) * CELL_W;
    const y = Math.floor(i / COLS) * CELL_H + 130;
    return `
    <g transform="translate(${x} ${y})">
      <rect x="20" y="14" width="${CELL_W - 40}" height="${CELL_H - 40}" rx="26"
            fill="#11161D" stroke="#1E2630" stroke-width="2"/>

      <svg x="150" y="42" width="260" height="260">${icon(it, BRAND, WHITE)}</svg>

      <!-- Prueba del entrecerrar los ojos: 48 · 32 · 24 · 16px reales -->
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
    <text x="46" y="58" font-family="${FONT}" font-size="34" font-weight="700" fill="${WHITE}">fluws — registro telecom</text>
    <text x="46" y="92" font-family="${FONT}" font-size="21" fill="${GRAY}">Emisión, órbita, duplex, barras de señal, central. Arcos horizontales y de a dos, para no caer en el ícono de wifi.</text>
    <text x="46" y="120" font-family="${FONT}" font-size="19" fill="${GRAY}">Probadas a 48 · 32 · 24 · 16px reales, más la versión oscura para fondo claro.</text>
    ${cells}
  </svg>`;
}

(async () => {
  const outDir = process.argv[2] || 'scripts/out';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'simbolo-telecom.png');
  await sharp(Buffer.from(sheet())).png().toFile(file);
  console.log('listo →', path.resolve(file));
})();
