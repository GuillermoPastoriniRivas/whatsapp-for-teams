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

/** Órbita de 323.3° con la boca enfrentada a la patita (centrada en 316°). Lo
 *  que se elige no es el ángulo sino el aire entre las puntas: φ × trazo = 58.2,
 *  que sobre el eje de 147 da 36.7° de boca. Lo fijo es el borde EXTERIOR en
 *  r=165: el eje sale de 165 − trazo/2, y las puntas del arco se recalculan con
 *  ese eje. Ver el componente. */
const ORBIT_PATH = 'M388.5 192.4A147 147 0 1 1 324.3 125.8';
const ORBIT_STROKE = 36;
/** Núcleo y su patita salen de UNA sola constante: k = 0.4291, la homotecia
 *  desde el centro que reduce la burbuja de afuera a la de adentro. Sale de
 *  hueco = φ × trazo = 58.2, o sea núcleo = 129 − 58.2 = 70.8. El sistema
 *  completo, con lo que se descartó, está en el componente. */
const CORE_R = 70.8;
const CORE_TAIL_PATH = 'M225.8 312.8L187.5 322.2L199.2 286.2Z';
const CORE_TAIL_STROKE = 7.7;
/** Patita abajo a la izquierda, con la base apoyada sobre la banda del trazo. */
const TAIL_PATH = 'M185.6 388.4L96.3 410.2L123.6 326.4Z';
const TAIL_STROKE = 18;
/** Corte del anillo debajo de la patita: triángulo semejante a ella, aristas
 *  paralelas, punta hacia afuera en r=163 y base de 53.8. La punta es el único
 *  número que se elige: la base queda adentro del hueco y no se ve. Ver el
 *  componente — ni la orientación ni los radios son indistintos. */
const CUT_PATH = 'M138.8 369.2L154.8 316.3L192.2 355Z';
/** Bbox del glifo: x 87.3→421, y 91→421. */
const MARK_VIEWBOX = '81 85 346 342';

const GREEN = '#15A58A';

/**
 * @param id  Cada SVG que se rasteriza es un documento propio, pero igual lleva
 *   id distinto por archivo: si algún día se concatenan en un sprite, dos
 *   máscaras con el mismo id se pisan y gana la última.
 */
const glyph = (color, id) =>
  `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">` +
  `<rect width="512" height="512" fill="#fff"/><path d="${CUT_PATH}" fill="#000"/></mask>` +
  `<g mask="url(#${id})">` +
  `<path d="${ORBIT_PATH}" fill="none" stroke="${color}" stroke-width="${ORBIT_STROKE}" stroke-linecap="round"/>` +
  `<path d="${TAIL_PATH}" fill="${color}" stroke="${color}" stroke-width="${TAIL_STROKE}" stroke-linejoin="round"/>` +
  `</g>` +
  // Fuera de la máscara: el corte no debe tocar el núcleo ni su patita.
  `<path d="${CORE_TAIL_PATH}" fill="${color}" stroke="${color}" stroke-width="${CORE_TAIL_STROKE}" stroke-linejoin="round"/>` +
  `<circle cx="256" cy="256" r="${CORE_R}" fill="${color}"/>`;

/**
 * El símbolo blanco sobre el cuadrado verde.
 *
 * @param bleed  Cuadrado a sangre, sin esquinas transparentes. Es lo que
 *   necesitan los maskable y el apple-icon: iOS y Android aplican su propia
 *   máscara encima y una esquina transparente se ve recortada contra el fondo
 *   del launcher. Además el glifo va más chico, porque esas máscaras comen
 *   hasta un 10% de cada borde.
 *
 *   El maskable es el que MENOS puede crecer, y no por gusto: la punta de la
 *   patita queda a 234.7 del centro (de 512) sin escalar, y la zona segura de
 *   Android es un círculo de radio 204.8. O sea que el techo del maskable es
 *   0.873 — arriba de eso la máscara circular le come la patita. Por eso no
 *   acompaña al 1.12 del cuadrado normal.
 * @param glyphScale  Escala del glifo dentro del cuadrado. En 1 ocupa el ~65%
 *   del lado; el 1.12 de base lo lleva al ~72%, arriba de la banda donde las
 *   guías ponen el contenido pero con el símbolo ya sin verse flotando en el
 *   cuadrado. Espeja `APP_GLYPH_SCALE` del componente.
 */
const appSvg = ({ bleed = false, glyphScale = bleed ? 0.85 : 1.12, id = 'cut' } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="${bleed ? 0 : 115}" fill="${GREEN}"/>
  <g transform="translate(256 256) scale(${glyphScale}) translate(-256 -256)">${glyph('#FFFFFF', id)}</g>
</svg>`;

/**
 * Badge de notificación de Android: silueta blanca sobre transparente. El
 * sistema se queda SOLO con el canal alfa y la pinta de un color propio, así
 * que va el glifo suelto — con el cuadrado verde se vería un bloque macizo en
 * la barra de estado.
 */
const badgeSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" fill="none">${glyph('#FFFFFF', 'cut-badge')}</svg>`;

/**
 * Favicon: el mismo cuadrado verde, con el glifo un poco más grande. A 16px el
 * aire del contenedor pesa mucho más en proporción y con la escala del ícono
 * grande el símbolo queda chico y flotando.
 *
 * El techo acá no es la zona segura sino el radio de 115 del cuadrado: a 1.2 la
 * punta de la patita queda a 31 (de 512) del arco de la esquina, que a 16px es
 * un pixel. Más grande y la patita toca el borde redondeado.
 */
const faviconSvg = () => appSvg({ glyphScale: 1.2, id: 'cut-favicon' });

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
  // Va más grande que el maskable: la máscara de iOS es un superelipse, no un
  // círculo, y en la diagonal recorta bastante menos que Android.
  write('src/app/apple-icon.png', await render(appSvg({ bleed: true, glyphScale: 0.96 }), 180));

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
