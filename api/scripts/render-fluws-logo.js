/* Genera los íconos de fluws desde la misma geometría que el componente SVG.
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

/* Núcleo macizo + órbita de 320° con la boca arriba, más la patita abajo a la
   izquierda. Color plano, como manda el brand board.

   La base de la patita se apoya sobre la banda del trazo de la órbita para que
   quede fundida con el anillo. Se dibuja con relleno Y trazo del mismo color:
   así se le redondean las esquinas y queda con el mismo acabado que los caps
   de la órbita. */
const ORBIT_PATH = 'M304.6 122.6A142 142 0 1 1 207.4 122.6';
const ORBIT_STROKE = 46;
const CORE_R = 54;
const TAIL_PATH = 'M185.6 388.4L84.8 421.3L123.6 326.4Z';
const TAIL_STROKE = 18;
const MARK_VIEWBOX = '70 94 357 343';

const GREEN = '#02721C';
const INK = '#0B0F14';

const glyph = (color) =>
  `<path d="${ORBIT_PATH}" fill="none" stroke="${color}" stroke-width="${ORBIT_STROKE}" stroke-linecap="round"/>` +
  `<path d="${TAIL_PATH}" fill="${color}" stroke="${color}" stroke-width="${TAIL_STROKE}" stroke-linejoin="round"/>` +
  `<circle cx="256" cy="256" r="${CORE_R}" fill="${color}"/>`;

/** El símbolo suelto, verde sobre transparente. */
const markSvg = (color = GREEN) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" fill="none">${glyph(color)}</svg>`;

/**
 * El símbolo blanco sobre el cuadrado verde.
 * @param bleed  El cuadrado va a sangre (radio 0). Es lo que necesitan los
 *   maskable y el apple-icon: iOS y Android aplican su propia máscara encima,
 *   así que una esquina transparente se ve recortada. Además el glifo va más
 *   chico, porque esas máscaras comen hasta un 10% de cada borde.
 * @param glyphScale  Escala del glifo dentro del cuadrado (1 = tamaño nativo,
 *   que ya deja el aire correcto para el radio del contenedor).
 */
const appSvg = ({ bleed = false, glyphScale = bleed ? 0.8 : 1 } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="${bleed ? 0 : 115}" fill="${GREEN}"/>
  <g transform="translate(256 256) scale(${glyphScale}) translate(-256 -256)">${glyph('#FFFFFF')}</g>
</svg>`;

/* El badge de las notificaciones push: Android se queda SOLO con el canal alfa
   y pinta la silueta de un color propio. Por eso va el glifo suelto y no el
   cuadrado verde — si no, en la barra de estado se ve un cuadrado macizo. */
const badgeSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" fill="none">${glyph('#FFFFFF')}</svg>`;

/* El favicon va SIN cuadrado: el glifo verde sobre transparente.
   Al no haber contenedor que respetar, el glifo se escala para llenar el cuadro
   con un margen chico. El bbox mide 345.2 × 330.7 y está centrado en
   (248.4, 264.95) — no en (256,256), porque la patita corre el peso hacia
   abajo y a la izquierda —, así que hay que recentrarlo además de escalarlo.
   Con 1.35 el glifo ocupa 466 de los 512 y quedan ~23 de aire por lado. */
const faviconSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <g transform="translate(256 256) scale(1.35) translate(-248.4 -264.95)">${glyph(GREEN)}</g>
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
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + pngs.length * 16;
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
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

  const [icon1024, icon512, icon192, mask1024, mask512, mask192, apple, badge, fav48, fav32, fav16, mark] =
    await Promise.all([
      render(appSvg(), 1024),
      render(appSvg(), 512),
      render(appSvg(), 192),
      render(appSvg({ bleed: true }), 1024),
      render(appSvg({ bleed: true }), 512),
      render(appSvg({ bleed: true }), 192),
      render(appSvg({ bleed: true, glyphScale: 0.86 }), 180),
      render(badgeSvg(), 72),
      render(faviconSvg(), 48),
      render(faviconSvg(), 32),
      render(faviconSvg(), 16),
      render(markSvg(), 512),
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
    write('public/icons/mark-512.png', mark),
  ];

  console.log(written.map((f) => '  ' + f).join('\n'));
})();
