/* Tamaño de la patita: que salga del propio trazo del arco.
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/fluws-patita.js [carpeta]

   Intento anterior, y por que estuvo mal: se probo ahuecar la patita y para que
   el hueco se leyera hubo que agrandarla. Terminó siendo un apendice en V
   pegado por fuera que competia con el anillo, y a 16px el hueco se cerraba
   igual. Ademas el efecto de WhatsApp no es transferible: alli la cola hueca
   funciona porque la burbuja es un CONTORNO CERRADO y la cola continua ese
   contorno. Nuestro simbolo es un arco abierto.

   Lo correcto es lo contrario: que la patita sea CHICA y salga del trazo, con
   la base del ancho del propio trazo (46) apoyada sobre la banda del anillo.
   Asi lee como el arco que se estira en una punta, no como una pieza agregada.

   La base se pone a r=155 —dentro de la banda, que va de 119 a 165— para que
   quede fundida con el anillo. La abertura angular se elige para que la cuerda
   de la base mida aproximadamente lo mismo que el grosor del trazo. */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const GREEN = '#027E5A';
const INK = '#0B0F14';
const WHITE = '#FFFFFF';
const GRAY = '#7C8896';

const ORBIT = 'M304.6 122.6A142 142 0 1 1 207.4 122.6';
const ORBIT_W = 46;

const P = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return `${(256 + r * Math.cos(a)).toFixed(1)} ${(256 + r * Math.sin(a)).toFixed(1)}`;
};

/**
 * Patita como prolongación del trazo.
 * @param spread  Abertura angular de la base, en grados. A r=155, 18° dan una
 *   cuerda de ~49, casi igual al grosor del trazo (46).
 * @param tipR    Hasta donde llega la punta.
 * @param round   Grosor del trazo que redondea las esquinas. 0 = punta viva.
 */
const tail = (spread, tipR, round = 10) =>
  `<path d="M${P(135 - spread / 2, 155)}L${P(135, tipR)}L${P(135 + spread / 2, 155)}Z"
         fill="COLOR" stroke="COLOR" stroke-width="${round}" stroke-linejoin="round"/>`;

const OPTIONS = [
  {
    id: 'a',
    label: 'La de hoy',
    note: 'Base de 34° y punta a r=238. Es una pieza aparte.',
    tail: `<path d="M185.6 388.4L84.8 421.3L123.6 326.4Z" fill="COLOR" stroke="COLOR"
                 stroke-width="18" stroke-linejoin="round"/>`,
  },
  { id: 'b', label: 'Chica, punta a 225', note: 'Base del ancho del trazo. Sale del arco.', tail: tail(18, 225) },
  { id: 'c', label: 'Chica, punta a 205', note: 'Aun mas corta: apenas asoma.', tail: tail(18, 205) },
  { id: 'd', label: 'Chica y afilada', note: 'Misma base, punta viva a 240.', tail: tail(16, 240, 4) },
];

const glyph = (o, color) =>
  `<path d="${ORBIT}" fill="none" stroke="${color}" stroke-width="${ORBIT_W}" stroke-linecap="round"/>` +
  o.tail.split('COLOR').join(color) +
  `<circle cx="256" cy="256" r="54" fill="${color}"/>`;

const icon = (o, bg, fg, scale = 1) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
  (bg ? `<rect width="512" height="512" rx="115" fill="${bg}"/>` : '') +
  `<g transform="translate(256 256) scale(${scale}) translate(-248.4 -258)">${glyph(o, fg)}</g></svg>`;

const CELL_W = 560;
const CELL_H = 520;
const FONT = 'Segoe UI, Arial, sans-serif';

function sheet() {
  const W = OPTIONS.length * CELL_W;
  const H = CELL_H + 120;
  const cells = OPTIONS.map((o, i) => {
    const fav = icon(o, null, GREEN, 1.3);
    const strip = (bg, oy) =>
      `<rect x="46" y="${oy}" width="${CELL_W - 92}" height="64" rx="12" fill="${bg}"/>` +
      [48, 32, 24, 16].map((px, n) =>
        `<svg x="${72 + n * 92}" y="${oy + 32 - px / 2}" width="${px}" height="${px}">${fav}</svg>`).join('');
    return `
    <g transform="translate(${i * CELL_W} 120)">
      <rect x="20" y="10" width="${CELL_W - 40}" height="${CELL_H - 40}" rx="24"
            fill="#11161D" stroke="#1E2630" stroke-width="2"/>
      <svg x="150" y="30" width="260" height="260">${icon(o, GREEN, WHITE, 0.94)}</svg>
      ${strip('#FFFFFF', 310)}
      ${strip('#202124', 384)}
      <text x="46" y="474" font-family="${FONT}" font-size="23" font-weight="600" fill="${WHITE}">${o.label}</text>
      <text x="46" y="502" font-family="${FONT}" font-size="18" fill="${GRAY}">${o.note}</text>
    </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <text x="46" y="54" font-family="${FONT}" font-size="32" font-weight="700" fill="${WHITE}">fluws — la patita sale del trazo, no se agrega</text>
    <text x="46" y="90" font-family="${FONT}" font-size="20" fill="${GRAY}">Base del ancho del propio trazo, apoyada sobre la banda del anillo. Ícono arriba; favicon a 48 · 32 · 24 · 16px.</text>
    ${cells}
  </svg>`;
}

(async () => {
  const outDir = process.argv[2] || 'scripts/out';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'fluws-patita.png');
  await sharp(Buffer.from(sheet())).png().toFile(file);
  console.log('listo →', path.resolve(file));
})();
