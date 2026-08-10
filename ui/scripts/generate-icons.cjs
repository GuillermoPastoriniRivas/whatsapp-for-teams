/**
 * Genera todos los íconos de la app desde la geometría SVG del símbolo.
 *
 *   node scripts/generate-icons.cjs
 *
 * TODO ES VECTORIAL. Hubo una etapa con arte 3D en `brand/logo-source.png` y
 * este script derivaba los íconos de ese PNG; se volvió a SVG a propósito. La
 * consecuencia práctica: no hay relieve, biselado ni sombra, y no debería
 * haberlos — si vuelven, vuelve también el problema de tener el logo definido
 * en dos lugares que nadie mantiene sincronizados.
 *
 * OJO: la geometría está duplicada de `src/components/brand/fluws-logo.tsx`
 * porque un .cjs no puede importar TSX. Si cambia el componente, hay que
 * reflejarlo acá y volver a correr esto. Es la única duplicación deliberada.
 *
 * Después de correrlo hay que bumpear SHELL_CACHE en `public/sw.js`: es la
 * única forma de que una PWA ya instalada suelte el ícono viejo, que además es
 * el de las notificaciones push.
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const ICONS = path.join(ROOT, 'public', 'icons');

/* ---- Geometría: espejo de src/components/brand/fluws-logo.tsx ---- */

/** Órbita de 317° con la boca enfrentada a la patita (centrada en 316°). */
const ORBIT_PATH = 'M387.2 201.7A142 142 0 1 1 314.9 126.8';
const ORBIT_STROKE = 46;
const CORE_R = 54;
/** Cola de burbuja abajo a la izquierda: gota, no cuña. Ver el componente. */
const TAIL_PATH = 'M194.2 409Q144.4 427.9 99.7 417.8Q126 340.4 101 312.4Z';
/** Bbox del glifo: x 87.3→421, y 91→421. */
const MARK_VIEWBOX = '85 85 342 342';

const GREEN = '#15A58A';

const glyph = (color) =>
  `<path d="${ORBIT_PATH}" fill="none" stroke="${color}" stroke-width="${ORBIT_STROKE}" stroke-linecap="round"/>` +
  `<path d="${TAIL_PATH}" fill="${color}"/>` +
  `<circle cx="256" cy="256" r="${CORE_R}" fill="${color}"/>`;

/**
 * El símbolo blanco sobre el cuadrado verde.
 *
 * @param bleed  Cuadrado a sangre, sin esquinas transparentes. Es lo que
 *   necesitan los maskable y el apple-icon: iOS y Android aplican su propia
 *   máscara encima y una esquina transparente se ve recortada contra el fondo
 *   del launcher. Además el glifo va más chico, porque esas máscaras comen
 *   hasta un 10% de cada borde.
 * @param glyphScale  Escala del glifo dentro del cuadrado. En 1 ocupa el ~65%
 *   del lado, que es la banda donde las guías de íconos ponen el contenido.
 */
const appSvg = ({ bleed = false, glyphScale = bleed ? 0.8 : 1 } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="${bleed ? 0 : 115}" fill="${GREEN}"/>
  <g transform="translate(256 256) scale(${glyphScale}) translate(-256 -256)">${glyph('#FFFFFF')}</g>
</svg>`;

/**
 * Badge de notificación de Android: silueta blanca sobre transparente. El
 * sistema se queda SOLO con el canal alfa y la pinta de un color propio, así
 * que va el glifo suelto — con el cuadrado verde se vería un bloque macizo en
 * la barra de estado.
 */
const badgeSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" fill="none">${glyph('#FFFFFF')}</svg>`;

/**
 * Favicon: el mismo cuadrado verde, con el glifo un poco más grande. A 16px el
 * aire del contenedor pesa mucho más en proporción y con la escala del ícono
 * grande el símbolo queda chico y flotando.
 */
const faviconSvg = () => appSvg({ glyphScale: 1.12 });

const render = (svg, size) =>
  sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

/**
 * Contenedor ICO con PNGs adentro (soportado desde Vista). Se arma a mano para
 * no sumar una dependencia por 30 líneas: cabecera de 6 bytes + una entrada de
 * 16 por tamaño + los PNG concatenados.
 */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // 1 = ícono
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const dir = entries.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
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

  return Buffer.concat([header, ...dir, ...entries.map((e) => e.data)]);
}

async function main() {
  fs.mkdirSync(ICONS, { recursive: true });
  const write = (rel, buf) => {
    const file = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf);
    console.log('  ·', rel);
  };

  for (const size of [192, 512, 1024]) {
    write(`public/icons/icon-${size}.png`, await render(appSvg(), size));
    write(`public/icons/icon-maskable-${size}.png`, await render(appSvg({ bleed: true }), size));
  }

  // Next levanta estos dos por convención desde src/app/.
  write('src/app/apple-icon.png', await render(appSvg({ bleed: true, glyphScale: 0.86 }), 180));

  const ico = buildIco(
    await Promise.all(
      [16, 32, 48].map(async (size) => ({ size, data: await render(faviconSvg(), size) })),
    ),
  );
  write('src/app/favicon.ico', ico);
  write('public/favicon.ico', ico);

  write('public/icons/badge-72.png', await render(badgeSvg(), 72));

  // El que consume la variante `app` del componente, para no re-renderizar el
  // SVG en cada pantalla. Mismo arte que el ícono instalado.
  write('public/icons/logo-512.png', await render(appSvg(), 512));

  console.log('\nListo. Acordate de bumpear SHELL_CACHE en public/sw.js.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
