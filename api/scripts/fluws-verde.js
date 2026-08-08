/* Candidatos de verde de marca, cada uno en TODOS sus usos reales.
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/fluws-verde.js [carpeta]

   El verde de marca tiene que servir para cinco cosas a la vez, y algunas
   piden lo contrario que otras:

   1. Fondo del panel de auth en claro, con texto BLANCO encima  -> pide oscuro
   2. Color de texto sobre blanco (los links tipo "Registrate")  -> pide oscuro
   3. Fondo de boton primario, con texto blanco                  -> pide oscuro
   4. Cuadrado del icono de app, con el glifo blanco             -> pide vivo
   5. Favicon sobre barra de pestanas clara Y oscura             -> pide medio

   Por eso el candidato no se elige por el numero solo: hay que mirar 4 y 5.

   Ademas tiene que quedar lejos de Flow (#00BFA9) y de WhatsApp (#25D366), que
   son las dos colisiones ya detectadas. */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const INK = '#0B0F14';
const WHITE = '#FFFFFF';
const GRAY = '#7C8896';

const ORBIT = 'M304.6 122.6A142 142 0 1 1 207.4 122.6';
const TAIL = 'M185.6 388.4L84.8 421.3L123.6 326.4Z';

const srgb = (h) =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
const lum = (h) => { const [r, g, b] = srgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const CANDIDATES = [
  { hex: '#3ED47A', label: 'Lima (el de ahora)', note: 'Falla: 1.93:1 contra blanco, y es WhatsApp.' },
  { hex: '#02721C', label: 'Verde vivo', note: 'El mas lejos de ambos que sigue siendo verde puro.' },
  { hex: '#156F41', label: 'Esmeralda profundo', note: 'Mas apagado, mas corporativo.' },
  { hex: '#027E5A', label: 'Esmeralda', note: 'El mas cercano al verde de asis. Menos separacion.' },
  { hex: '#0F8A4F', label: 'Verde medio', note: 'Intermedio: conserva vida y aguanta blanco encima.' },
];

const glyph = (color) =>
  `<path d="${ORBIT}" fill="none" stroke="${color}" stroke-width="46" stroke-linecap="round"/>` +
  `<path d="${TAIL}" fill="${color}" stroke="${color}" stroke-width="18" stroke-linejoin="round"/>` +
  `<circle cx="256" cy="256" r="54" fill="${color}"/>`;

const appIcon = (c) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="115" fill="${c}"/>${glyph(WHITE)}</svg>`;
const favicon = (c) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g transform="translate(256 256) scale(1.35) translate(-248.4 -264.95)">${glyph(c)}</g></svg>`;

const CELL_W = 560;
const CELL_H = 640;
const FONT = 'Segoe UI, Arial, sans-serif';

function sheet() {
  const W = CANDIDATES.length * CELL_W;
  const H = CELL_H + 130;

  const cells = CANDIDATES.map((c, i) => {
    const cw = ratio(c.hex, WHITE);
    const ok = cw >= 4.5;
    const fav = favicon(c.hex);
    return `
    <g transform="translate(${i * CELL_W} 130)">
      <rect x="20" y="10" width="${CELL_W - 40}" height="${CELL_H - 40}" rx="24"
            fill="#11161D" stroke="${ok ? '#1E2630' : '#7A2E2E'}" stroke-width="2"/>

      <!-- 4. Icono de app -->
      <svg x="46" y="34" width="150" height="150">${appIcon(c.hex)}</svg>

      <!-- 1 y 3. Panel y boton con texto BLANCO encima -->
      <rect x="212" y="34" width="${CELL_W - 258}" height="150" rx="18" fill="${c.hex}"/>
      <text x="234" y="86" font-family="${FONT}" font-size="26" font-weight="600" fill="${WHITE}">Texto blanco</text>
      <text x="234" y="118" font-family="${FONT}" font-size="19" fill="${WHITE}" opacity="0.85">sobre el verde</text>
      <rect x="234" y="134" width="150" height="36" rx="10" fill="${WHITE}"/>
      <text x="258" y="159" font-family="${FONT}" font-size="18" font-weight="600" fill="${c.hex}">Boton</text>

      <!-- 2. Texto verde sobre blanco -->
      <rect x="46" y="204" width="${CELL_W - 92}" height="70" rx="14" fill="${WHITE}"/>
      <text x="70" y="248" font-family="${FONT}" font-size="24" fill="${c.hex}">¿No tenés cuenta? Registrate</text>

      <!-- 5. Favicon sobre barra clara y sobre barra oscura -->
      ${[['#FFFFFF', 292], ['#202124', 366]]
        .map(([bg, y]) =>
          `<rect x="46" y="${y}" width="${CELL_W - 92}" height="62" rx="12" fill="${bg}"/>` +
          [40, 28, 20, 16].map((px, n) =>
            `<svg x="${76 + n * 92}" y="${y + 31 - px / 2}" width="${px}" height="${px}">${fav}</svg>`).join('')
        ).join('')}

      <text x="46" y="470" font-family="${FONT}" font-size="23" font-weight="600" fill="${WHITE}">${c.label}</text>
      <text x="46" y="500" font-family="${FONT}" font-size="18" fill="${GRAY}">${c.hex}</text>
      <text x="46" y="534" font-family="${FONT}" font-size="19" fill="${ok ? '#4ADE80' : '#F87171'}">
        ${cw.toFixed(2)}:1 contra blanco ${ok ? '· cumple AA' : '· NO cumple'}
      </text>
      <text x="46" y="566" font-family="${FONT}" font-size="18" fill="${GRAY}">${c.note}</text>
    </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <text x="46" y="54" font-family="${FONT}" font-size="32" font-weight="700" fill="${WHITE}">fluws — qué verde aguanta los cinco usos</text>
    <text x="46" y="90" font-family="${FONT}" font-size="20" fill="${GRAY}">Ícono de app · panel y botón con texto blanco · texto verde sobre blanco · favicon en barra clara y oscura.</text>
    <text x="46" y="116" font-family="${FONT}" font-size="18" fill="${GRAY}">El borde de la tarjeta se pone rojo cuando el verde no soporta texto blanco encima.</text>
    ${cells}
  </svg>`;
}

(async () => {
  const outDir = process.argv[2] || 'scripts/out';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'fluws-verde.png');
  await sharp(Buffer.from(sheet())).png().toFile(file);
  console.log('listo →', path.resolve(file));
})();
