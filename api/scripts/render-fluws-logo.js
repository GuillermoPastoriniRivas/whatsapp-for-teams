/* Genera los íconos de Fluws desde la misma geometría que el componente SVG.
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/render-fluws-logo.js            # escribe en ui/
     node scripts/render-fluws-logo.js <carpeta>  # o donde le digas, para mirar

   La geometría está duplicada de ui/src/components/brand/fluws-logo.tsx a
   propósito: este script no puede importar TSX. Si cambia el componente, hay
   que reflejarlo acá y volver a correr.

   Después de tocar los íconos hay que bumpear SHELL_CACHE en ui/public/sw.js:
   es la única forma de que una PWA ya instalada deje de servir el ícono viejo,
   que además es el de las notificaciones push. */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/* Geometría LITERAL del boceto elegido (concepto B de fluws-logo-concepts.js).
   Tiene que quedar idéntica a la del componente TSX. */
const STROKE = 40;
const NODE_IN = { cx: 136, cy: 256, r: 50 };
const NODE_UP = { cx: 374, cy: 154, r: 44 };
const NODE_DOWN = { cx: 374, cy: 358, r: 44 };
const EDGE_UP = 'M186 256C248 256 262 178 330 162';
const EDGE_DOWN = 'M186 256C248 256 262 334 330 350';
const MARK_VIEWBOX = '80 104 344 304';
/** Centro real del bbox; no es 256 en x (el nodo de origen es más grande). */
const GLYPH_CENTER = { x: 252, y: 256 };

const TEAL_DARK = '#0FA292';
const TEAL_MID = '#23C7A6';
const TEAL_LIGHT = '#4AE4BC';

/* Aristas de trazo, nodos macizos. Las aristas van primero para que los
   círculos les tapen los caps redondos. */
const node = (n, color) => `<circle cx="${n.cx}" cy="${n.cy}" r="${n.r}" fill="${color}"/>`;

const strokes = (color) =>
  `<g stroke="${color}" stroke-width="${STROKE}" stroke-linecap="round" fill="none">` +
  `<path d="${EDGE_UP}"/><path d="${EDGE_DOWN}"/></g>` +
  `${node(NODE_IN, color)}${node(NODE_UP, color)}${node(NODE_DOWN, color)}`;

/** La horquilla sola, degradado teal, fondo transparente: el logo del arte. */
const markSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" fill="none">
  <defs><linearGradient id="g" x1="0" y1="0.6" x2="1" y2="0.25">
    <stop offset="0" stop-color="${TEAL_DARK}"/>
    <stop offset="0.5" stop-color="${TEAL_MID}"/>
    <stop offset="1" stop-color="${TEAL_LIGHT}"/>
  </linearGradient></defs>
  ${strokes('url(#g)')}
</svg>`;

/**
 * El grafo blanco sobre el cuadrado teal.
 * @param bleed  El cuadrado va a sangre (radio 0). Es lo que necesitan los
 *   maskable y el apple-icon: iOS y Android aplican su propia máscara encima,
 *   así que una esquina transparente se ve recortada. Además el glifo va más
 *   chico, porque esas máscaras comen hasta un 10% de cada borde.
 * @param glyph  Escala del glifo dentro del cuadrado.
 */
const appSvg = ({ bleed = false, glyph = bleed ? 0.58 : 0.72 } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0.72">
    <stop offset="0" stop-color="${TEAL_LIGHT}"/>
    <stop offset="1" stop-color="${TEAL_DARK}"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="${bleed ? 0 : 100}" fill="url(#g)"/>
  <g transform="translate(256 256) scale(${glyph}) translate(${-GLYPH_CENTER.x} ${-GLYPH_CENTER.y})">${strokes('white')}</g>
</svg>`;

/* El badge de las notificaciones push: Android se queda SOLO con el canal alfa
   y pinta la silueta de un color propio. Por eso va el glifo suelto y no el
   cuadrado teal — si no, en la barra de estado se ve un cuadrado macizo. */
const badgeSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" fill="none">
  ${strokes('white')}
</svg>`;

const render = (svg, size) =>
  sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

/* Contenedor .ico con PNGs adentro (lo entienden todos los navegadores y
   Windows desde Vista). sharp no exporta .ico, así que se arma a mano:
   cabecera de 6 bytes + una entrada de 16 por tamaño + los PNG concatenados. */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // 1 = ícono
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + pngs.length * 16;
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 significa 256
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // paleta
    e.writeUInt8(0, 3); // reservado
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });

  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

(async () => {
  const target = process.argv[2];
  const ui = path.resolve(__dirname, '../../ui');
  const write = (rel, buf) => {
    const file = target ? path.join(target, path.basename(rel)) : path.join(ui, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf);
    return file;
  };

  const [
    icon1024, icon512, icon192,
    mask1024, mask512, mask192,
    apple, badge,
    fav48, fav32, fav16,
  ] = await Promise.all([
    render(appSvg(), 1024), render(appSvg(), 512), render(appSvg(), 192),
    render(appSvg({ bleed: true }), 1024),
    render(appSvg({ bleed: true }), 512),
    render(appSvg({ bleed: true }), 192),
    render(appSvg({ bleed: true, glyph: 0.66 }), 180),
    render(badgeSvg(), 72),
    // El favicon lleva el glifo más grande: al 72% se empasta y queda un
    // cuadrado teal con una mancha blanca en el medio.
    render(appSvg({ glyph: 0.9 }), 48),
    render(appSvg({ glyph: 0.9 }), 32),
    render(appSvg({ glyph: 0.9 }), 16),
  ]);

  const ico = buildIco([
    { size: 16, data: fav16 },
    { size: 32, data: fav32 },
    { size: 48, data: fav48 },
  ]);

  const written = [
    write('public/icons/icon-1024.png', icon1024),
    write('public/icons/icon-512.png', icon512),
    write('public/icons/icon-192.png', icon192),
    write('public/icons/icon-maskable-1024.png', mask1024),
    write('public/icons/icon-maskable-512.png', mask512),
    write('public/icons/icon-maskable-192.png', mask192),
    write('public/icons/badge-72.png', badge),
    write('src/app/apple-icon.png', apple),
    write('src/app/favicon.ico', ico),
    write('public/favicon.ico', ico),
    // Solo para revisar a ojo; no lo consume nadie.
    write('public/icons/mark-512.png', await render(markSvg(), 512)),
  ];

  console.log(written.map((f) => '  ' + f).join('\n'));
})();
