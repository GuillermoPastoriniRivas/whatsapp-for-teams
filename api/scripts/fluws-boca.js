/* Dónde va la boca de la órbita, y de cuántos grados.
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/fluws-boca.js [carpeta]

   El símbolo actual barre 320° con la boca arriba. Acá se compara contra la
   boca abierta hacia la derecha, que es la dirección en la que "sale" el flujo
   y además la que más se aleja del círculo cerrado de Flow.

   La patita queda siempre abajo a la izquierda: mover las dos cosas a la vez no
   deja saber cuál de los dos cambios está haciendo el trabajo. */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const GREEN = '#3ED47A';
const INK = '#0B0F14';
const WHITE = '#FFFFFF';
const GRAY = '#7C8896';

const TAIL = 'M185.6 388.4L84.8 421.3L123.6 326.4Z';
const R = 142;

/** Arco que barre `sweep` grados con la boca centrada en `mouthDeg`. */
function orbit(mouthDeg, sweep) {
  const gap = 360 - sweep;
  const from = mouthDeg + gap / 2;
  const to = mouthDeg - gap / 2 + 360;
  const p = (deg) => {
    const a = (deg * Math.PI) / 180;
    return `${(256 + R * Math.cos(a)).toFixed(1)} ${(256 + R * Math.sin(a)).toFixed(1)}`;
  };
  return `M${p(from)}A${R} ${R} 0 ${sweep > 180 ? 1 : 0} 1 ${p(to)}`;
}

const glyph = (mouthDeg, sweep, color) =>
  `<path d="${orbit(mouthDeg, sweep)}" fill="none" stroke="${color}" stroke-width="46" stroke-linecap="round"/>` +
  `<path d="${TAIL}" fill="${color}" stroke="${color}" stroke-width="18" stroke-linejoin="round"/>` +
  `<circle cx="256" cy="256" r="54" fill="${color}"/>`;

const OPTIONS = [
  { id: 'a', label: 'Actual · 320°, boca arriba', mouth: 270, sweep: 320 },
  { id: 'b', label: '300°, boca a la derecha', mouth: 0, sweep: 300 },
  { id: 'c', label: '320°, boca a la derecha', mouth: 0, sweep: 320 },
  { id: 'd', label: '280°, boca a la derecha', mouth: 0, sweep: 280 },
];

/* Escala y recentrado del favicon: el bbox del símbolo no está en el centro del
   lienzo porque la patita corre el peso hacia abajo y a la izquierda. */
const asIcon = (o, color, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
  (bg ? `<rect width="512" height="512" rx="115" fill="${bg}"/>` : '') +
  `<g transform="translate(256 256) scale(${bg ? 1 : 1.3}) translate(-248.4 -264.95)">${glyph(o.mouth, o.sweep, color)}</g>` +
  `</svg>`;

const CELL_W = 560;
const CELL_H = 520;
const FONT = 'Segoe UI, Arial, sans-serif';

function sheet() {
  const W = OPTIONS.length * CELL_W;
  const H = CELL_H + 120;
  const cells = OPTIONS.map((o, i) => {
    const fav = asIcon(o, GREEN, null);
    const strip = (bg, oy) =>
      `<rect x="46" y="${oy}" width="${CELL_W - 92}" height="64" rx="12" fill="${bg}"/>` +
      [48, 32, 24, 16]
        .map((px, n) => `<svg x="${72 + n * 92}" y="${oy + 32 - px / 2}" width="${px}" height="${px}">${fav}</svg>`)
        .join('');
    return `
    <g transform="translate(${i * CELL_W} 120)">
      <rect x="20" y="10" width="${CELL_W - 40}" height="${CELL_H - 40}" rx="24"
            fill="#11161D" stroke="#1E2630" stroke-width="2"/>
      <svg x="150" y="34" width="260" height="260">${asIcon(o, WHITE, GREEN)}</svg>
      ${strip('#FFFFFF', 314)}
      ${strip('#202124', 388)}
      <text x="46" y="484" font-family="${FONT}" font-size="23" font-weight="600" fill="${WHITE}">${o.label}</text>
    </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <text x="46" y="54" font-family="${FONT}" font-size="32" font-weight="700" fill="${WHITE}">fluws — dónde va la boca</text>
    <text x="46" y="90" font-family="${FONT}" font-size="20" fill="${GRAY}">Ícono de app arriba; abajo, favicon a 48 · 32 · 24 · 16px sobre barra clara y oscura. La patita no se mueve.</text>
    ${cells}
  </svg>`;
}

(async () => {
  const outDir = process.argv[2] || 'scripts/out';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'fluws-boca.png');
  await sharp(Buffer.from(sheet())).png().toFile(file);
  console.log('listo →', path.resolve(file));
})();
