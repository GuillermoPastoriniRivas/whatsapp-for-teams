/* Propuestas de símbolo para fluws, derivadas de la investigación de marcas
   enterprise B2B y del campo competitivo (Twilio, Intercom, Bird, Infobip,
   Sinch, Blip, Yalo).
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/fluws-symbol-enterprise.js [carpeta]

   Tres reglas que salieron de la investigación y que TODAS estas cumplen, a
   diferencia de lo que veníamos dibujando:

   1. Nada de imaginería literal. La burbuja de chat ata la marca a "chat"
      cuando el producto vende automatización, y además es territorio de
      Intercom, que construyó su identidad entera sobre esa forma.
   2. Masa, no pelo. El criterio técnico es la prueba del entrecerrar los ojos:
      sin líneas finas, sin elementos flotantes, 2-3 colores. Los anillos
      huecos con trazo de 18 sobre 512 se desintegran abajo de 32px.
   3. La continuidad con asis vive en el COLOR y en el cuadrado redondeado, que
      es lo único que la gente reconoce a tamaño de ícono. No en la burbuja.

   Paleta del brand board: #18C7A5 sobre #0B0F14, y el cuadrado verde con glifo
   blanco que hereda del ícono de asis. */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BRAND = '#18C7A5';
const INK = '#0B0F14';
const WHITE = '#FFFFFF';
const GRAY = '#7C8896';

const VIEWBOX = '0 0 512 512';
const SQUIRCLE =
  'M115 0H397A115 115 0 0 1 512 115V397A115 115 0 0 1 397 512H115A115 115 0 0 1 0 397V115A115 115 0 0 1 115 0Z';

/* La "f" en trazo grueso, con cola: el asta baja y se va hacia la derecha en
   vez de cortarse. Es la única letra distintiva de "fluws". */
const F_STEM = 'M186 430C238 452 272 414 272 344V212C272 158 312 128 366 142';
const F_BAR = 'M198 272H348';

const CONCEPTS = [
  {
    id: 'a',
    label: 'A · Monograma f',
    note: 'La f con cola: el asta no se corta, se va. Letra propia, masa suficiente, y funciona sola como ícono.',
    render: (c) =>
      `<g stroke="${c}" stroke-width="74" stroke-linecap="round" fill="none">
         <path d="${F_STEM}"/><path d="${F_BAR}"/>
       </g>`,
  },
  {
    id: 'b',
    label: 'B · Círculo que se vuelve cuadrado',
    note: 'La transformación sin metáfora: entra una forma y sale otra. Dos masas, cero líneas finas.',
    render: (c) =>
      `<circle cx="152" cy="256" r="116" fill="${c}"/>
       <rect x="244" y="140" width="232" height="232" rx="64" fill="${c}"/>`,
  },
  {
    id: 'c',
    label: 'C · Embudo',
    note: 'Muchos a uno, pero con trazo de 74 en vez de 18. La misma idea que te gustó, construida para sobrevivir.',
    render: (c) =>
      `<g stroke="${c}" stroke-width="74" stroke-linecap="round" fill="none">
         <path d="M96 132C220 132 236 256 306 256"/>
         <path d="M96 380C220 380 236 256 306 256"/>
         <path d="M306 256H416"/>
       </g>`,
  },
  {
    id: 'd',
    label: 'D · Nodos macizos',
    note: 'Tres entradas y un resultado que pesa más. Puntos macizos: es lo único que se reconoce a 16px.',
    render: (c) =>
      `<g stroke="${c}" stroke-width="40" stroke-linecap="round" fill="none">
         <path d="M118 124C224 124 244 256 296 256"/>
         <path d="M118 256H296"/>
         <path d="M118 388C224 388 244 256 296 256"/>
       </g>
       <circle cx="96" cy="124" r="48" fill="${c}"/>
       <circle cx="96" cy="256" r="48" fill="${c}"/>
       <circle cx="96" cy="388" r="48" fill="${c}"/>
       <circle cx="376" cy="256" r="88" fill="${c}"/>`,
  },
  {
    id: 'e',
    label: 'E · Contenedor con f en negativo',
    note: 'Pensada desde el ícono para afuera: el cuadrado ES la marca. La continuidad con asis está acá.',
    render: (c, id) =>
      `<mask id="mk-${id}">
         <rect width="512" height="512" fill="white"/>
         <g stroke="black" stroke-width="74" stroke-linecap="round" fill="none">
           <path d="${F_STEM}"/><path d="${F_BAR}"/>
         </g>
       </mask>
       <path d="${SQUIRCLE}" fill="${c}" mask="url(#mk-${id})"/>`,
  },
  {
    id: 'f',
    label: 'F · Contenedor con corte',
    note: 'El cuadrado partido por una diagonal que se desplaza: dos mitades que ya no encajan. Lo más abstracto.',
    render: (c, id) =>
      `<mask id="mk-${id}">
         <rect width="512" height="512" fill="white"/>
         <path d="M104 396L268 168" stroke="black" stroke-width="56" stroke-linecap="round"/>
         <path d="M300 344L408 196" stroke="black" stroke-width="56" stroke-linecap="round"/>
       </mask>
       <path d="${SQUIRCLE}" fill="${c}" mask="url(#mk-${id})"/>`,
  },
];

/* Los que ya son un contenedor no necesitan el cuadrado alrededor. */
const isContainer = (c) => c.id === 'e' || c.id === 'f';

const mark = (c, color, suffix) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">${c.render(color, c.id + suffix)}</svg>`;

const appIcon = (c, bg, fg, suffix) =>
  isContainer(c)
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">${c.render(fg === WHITE ? bg : fg, c.id + suffix)}</svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">
         <rect width="512" height="512" rx="115" fill="${bg}"/>
         <svg x="86" y="86" width="340" height="340" viewBox="${VIEWBOX}">${c.render(fg, c.id + suffix)}</svg>
       </svg>`;

const CELL_W = 640;
const CELL_H = 560;
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
  const rows = Math.ceil(CONCEPTS.length / COLS);
  const W = COLS * CELL_W;
  const H = rows * CELL_H + 130;

  const cells = CONCEPTS.map((c, i) => {
    const x = (i % COLS) * CELL_W;
    const y = Math.floor(i / COLS) * CELL_H + 130;
    return `
    <g transform="translate(${x} ${y})">
      <rect x="20" y="14" width="${CELL_W - 40}" height="${CELL_H - 40}" rx="26"
            fill="#11161D" stroke="#1E2630" stroke-width="2"/>

      <svg x="170" y="40" width="300" height="300">${mark(c, BRAND, '-big')}</svg>

      <!-- Prueba de entrecerrar los ojos: 64, 40, 24 y 16px reales -->
      <svg x="56" y="376" width="64" height="64">${mark(c, BRAND, '-s1')}</svg>
      <svg x="136" y="388" width="40" height="40">${mark(c, BRAND, '-s2')}</svg>
      <svg x="192" y="396" width="24" height="24">${mark(c, BRAND, '-s3')}</svg>
      <svg x="232" y="400" width="16" height="16">${mark(c, BRAND, '-s4')}</svg>

      <svg x="290" y="368" width="80" height="80">${appIcon(c, INK, BRAND, '-i1')}</svg>
      <svg x="386" y="368" width="80" height="80">${appIcon(c, BRAND, WHITE, '-i2')}</svg>

      <text x="56" y="490" font-family="${FONT}" font-size="25" font-weight="600" fill="${WHITE}">${c.label}</text>
      ${wrap(c.note, 64)
        .map(
          (line, n) =>
            `<text x="56" y="${520 + n * 24}" font-family="${FONT}" font-size="18" fill="${GRAY}">${line}</text>`
        )
        .join('')}
    </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <text x="46" y="58" font-family="${FONT}" font-size="34" font-weight="700" fill="${WHITE}">fluws — propuestas enterprise</text>
    <text x="46" y="92" font-family="${FONT}" font-size="21" fill="${GRAY}">Sin imaginería literal, con masa en vez de pelo, y la continuidad con asis puesta en el color y el cuadrado.</text>
    <text x="46" y="120" font-family="${FONT}" font-size="19" fill="${GRAY}">Cada tarjeta se prueba a 64 · 40 · 24 · 16px reales, y como ícono oscuro y verde.</text>
    ${cells}
  </svg>`;
}

(async () => {
  const outDir = process.argv[2] || 'scripts/out';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'simbolo-enterprise.png');
  await sharp(Buffer.from(sheet())).png().toFile(file);
  console.log('listo →', path.resolve(file));
})();
