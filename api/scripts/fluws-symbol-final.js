/* El símbolo elegido: tres entradas convergen en un nodo. Todo hueco.
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/fluws-symbol-final.js [carpeta]

   Viene de la variante "muchos a uno" recortada: se le sacó la cola larga y el
   terminal macizo, y el nodo de llegada quedó hueco igual que las entradas.

   Al perder la cola, el símbolo pasó de razón 1.8 a 1.22 — casi cuadrado. Eso
   lo vuelve MUCHO mejor ícono de app que cualquiera de las versiones anteriores,
   que entraban chiquitas y perdidas en el cuadrado.

   Lenguaje visual del brand board: color plano #18C7A5, trazo con caps y
   uniones redondas, fondo #0B0F14. */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BRAND = '#18C7A5';
const INK = '#0B0F14';
const WHITE = '#FFFFFF';
const GRAY = '#7C8896';

const STROKE = 18;

/* Espacio del glifo. Bbox real: x 15→267, y 39→281 (lo definen los anillos).
   Razón 1.04: prácticamente cuadrado, que es lo que lo vuelve buen ícono. */
const VIEWBOX = '9 33 264 254';

const IN_RINGS = [
  [46, 70],
  [46, 160],
  [46, 250],
];
const IN_R = 22;

/* El símbolo termina donde termina la convergencia: el nodo se apoya justo
   ahí, sin tramo de salida.

   Las tres entradas mueren en (206,160), que es el centro de la banda del trazo
   del nodo: ahí los caps redondos quedan tapados por el anillo y no asoman
   dentro del hueco, que es lo que delata el truco.

   Los segundos puntos de control NO están sobre la horizontal a propósito. Si
   las tres llegan tangentes al eje, se abrazan en los últimos tramos y forman
   un tronco grueso que lee como mancha. Llegan en ángulo. */
const EDGES = [
  'M68 70C124 70 160 128 206 160',
  'M68 160H206',
  'M68 250C124 250 160 192 206 160',
];

/** Nodo de llegada: hueco igual que las entradas, y más grande. */
const NODE = { c: [232, 160], r: 26 };

const glyph = (color) =>
  `<g stroke="${color}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round" fill="none">` +
  EDGES.map((d) => `<path d="${d}"/>`).join('') +
  IN_RINGS.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${IN_R}"/>`).join('') +
  `<circle cx="${NODE.c[0]}" cy="${NODE.c[1]}" r="${NODE.r}"/>` +
  `</g>`;

const appIcon = (bg, fg, glyphPad = 96) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="115" fill="${bg}"/>
    <svg x="${glyphPad}" y="${glyphPad}" width="${512 - glyphPad * 2}" height="${512 - glyphPad * 2}"
         viewBox="${VIEWBOX}">${glyph(fg)}</svg>
  </svg>`;

const FONT = 'Segoe UI, Arial, sans-serif';

function sheet() {
  const W = 1720;
  const H = 1000;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <text x="56" y="66" font-family="${FONT}" font-size="32" font-weight="700" fill="${WHITE}">fluws — símbolo final</text>
    <text x="56" y="100" font-family="${FONT}" font-size="21" fill="${GRAY}">Tres entradas convergen en un nodo. Todo hueco, sin cola ni terminal macizo.</text>

    <!-- Glifo grande -->
    <rect x="56" y="140" width="560" height="480" rx="26" fill="#11161D" stroke="#1E2630" stroke-width="2"/>
    <svg x="116" y="200" width="440" height="363" viewBox="${VIEWBOX}">${glyph(BRAND)}</svg>

    <!-- Lockup horizontal -->
    <rect x="648" y="140" width="1016" height="230" rx="26" fill="#11161D" stroke="#1E2630" stroke-width="2"/>
    <svg x="700" y="184" width="170" height="142" viewBox="${VIEWBOX}">${glyph(BRAND)}</svg>
    <text x="900" y="288" font-family="${FONT}" font-size="128" font-weight="300" fill="${WHITE}" letter-spacing="2">fluws</text>

    <!-- Lockup con tesis -->
    <rect x="648" y="392" width="1016" height="228" rx="26" fill="#11161D" stroke="#1E2630" stroke-width="2"/>
    <svg x="700" y="424" width="128" height="106" viewBox="${VIEWBOX}">${glyph(BRAND)}</svg>
    <text x="852" y="510" font-family="${FONT}" font-size="92" font-weight="300" fill="${WHITE}" letter-spacing="1">fluws</text>
    <text x="856" y="566" font-family="${FONT}" font-size="27" fill="${GRAY}">turns conversations into action</text>

    <!-- Íconos de app -->
    <rect x="56" y="648" width="560" height="296" rx="26" fill="#11161D" stroke="#1E2630" stroke-width="2"/>
    <text x="96" y="700" font-family="${FONT}" font-size="19" font-weight="600" fill="${GRAY}" letter-spacing="2">APP ICON</text>
    <svg x="96" y="722" width="180" height="180" viewBox="0 0 512 512">${appIcon(INK, BRAND)}</svg>
    <svg x="300" y="722" width="180" height="180" viewBox="0 0 512 512">${appIcon(BRAND, WHITE)}</svg>

    <!-- Tamaños chicos: la prueba que mata -->
    <rect x="648" y="648" width="500" height="296" rx="26" fill="#11161D" stroke="#1E2630" stroke-width="2"/>
    <text x="688" y="700" font-family="${FONT}" font-size="19" font-weight="600" fill="${GRAY}" letter-spacing="2">TAMAÑOS REALES</text>
    <svg x="688" y="736" width="128" height="106" viewBox="${VIEWBOX}">${glyph(BRAND)}</svg>
    <svg x="836" y="756" width="64" height="53" viewBox="${VIEWBOX}">${glyph(BRAND)}</svg>
    <svg x="920" y="766" width="40" height="33" viewBox="${VIEWBOX}">${glyph(BRAND)}</svg>
    <svg x="980" y="772" width="24" height="20" viewBox="${VIEWBOX}">${glyph(BRAND)}</svg>
    <text x="688" y="890" font-family="${FONT}" font-size="19" fill="${GRAY}">128 · 64 · 40 · 24 px de ancho</text>

    <!-- Monocromo -->
    <rect x="1180" y="648" width="484" height="296" rx="26" fill="#11161D" stroke="#1E2630" stroke-width="2"/>
    <text x="1220" y="700" font-family="${FONT}" font-size="19" font-weight="600" fill="${GRAY}" letter-spacing="2">MONOCROMO</text>
    <svg x="1220" y="726" width="180" height="149" viewBox="${VIEWBOX}">${glyph(WHITE)}</svg>
    <svg x="1440" y="726" width="180" height="149" viewBox="${VIEWBOX}">${glyph(GRAY)}</svg>
    <text x="1220" y="906" font-family="${FONT}" font-size="19" fill="${GRAY}">blanco · gris</text>
  </svg>`;
}

(async () => {
  const outDir = process.argv[2] || 'scripts/out';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'simbolo-final.png');
  await sharp(Buffer.from(sheet())).png().toFile(file);
  console.log('listo →', path.resolve(file));
})();
