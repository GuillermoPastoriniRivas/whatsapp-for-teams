/* fluws: belleza formal por construcción.
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/fluws-symbol-form.js [carpeta]

   Cambio de enfoque respecto de la tanda de la anomalía: romper una forma a
   propósito termina leyendo como descuido, no como decisión. Acá la
   originalidad viene de la CONSTRUCCIÓN — espirales con progresión real,
   curvas continuas, tangencias exactas, ritmos que se derivan de una fórmula y
   no de un ojímetro.

   Todas las curvas complicadas se calculan, no se dibujan a mano: espiral
   arquimediana, anillo modulado por seno, hélice. Eso es lo que hace que se
   vean "resueltas" y no aproximadas.

   Descartado y por qué: burbuja (literal, y de Intercom), horquilla (glifo de
   compartir), monograma "f" (Facebook), barras de señal limpias (ícono de la
   barra de estado), abanico de arcos (wifi y RSS), y cualquier cosa
   desalineada a propósito (lee como error). */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BRAND = '#18C7A5';
const INK = '#0B0F14';
const WHITE = '#FFFFFF';
const GRAY = '#7C8896';

const VIEWBOX = '0 0 512 512';
const C = 256; // centro

const pt = (x, y) => `${x.toFixed(1)} ${y.toFixed(1)}`;

/** Espiral arquimediana: r crece linealmente con el ángulo. Muestreada fino y
 *  unida con segmentos rectos — a esta escala y con uniones redondas, la
 *  diferencia contra curvas de Bézier no se ve. */
function spiral(r0, r1, turns, phase = 0, steps = 240) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = phase + t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    pts.push(pt(C + r * Math.cos(a), C + r * Math.sin(a)));
  }
  return 'M' + pts.join('L');
}

/** Anillo modulado por un seno: r(θ) = R + amp·sin(lóbulos·θ). Cerrado. */
function waveRing(R, amp, lobes, steps = 360) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = R + amp * Math.sin(lobes * a);
    pts.push(pt(C + r * Math.cos(a), C + r * Math.sin(a)));
  }
  return 'M' + pts.join('L') + 'Z';
}

/** Media onda de seno, horizontal, para armar hélices y cintas. */
function sineArc(x0, x1, yMid, amp, phase, steps = 120) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(pt(x0 + (x1 - x0) * t, yMid + amp * Math.sin(phase + t * Math.PI * 2)));
  }
  return 'M' + pts.join('L');
}

const stroke = (d, c, w, extra = '') =>
  `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

const INTERIORS = [
  {
    id: 'a',
    label: 'A · Espiral',
    idea: 'Una espiral arquimediana real: el radio crece parejo con el ángulo. Flujo que no vuelve al mismo lugar.',
    render: (c) => stroke(spiral(30, 168, 1.6, Math.PI * 0.6), c, 44),
  },
  {
    id: 'b',
    label: 'B · Espiral con núcleo',
    idea: 'La misma progresión, arrancando desde una masa. El origen pesa y el recorrido se abre.',
    render: (c) =>
      `<circle cx="${C}" cy="${C}" r="46" fill="${c}"/>` +
      stroke(spiral(92, 176, 1.15, Math.PI * 1.15), c, 42),
  },
  {
    id: 'c',
    label: 'C · Anillo modulado',
    idea: 'Un anillo cuyo radio lo modula un seno de tres lóbulos. Es una onda cerrada sobre sí misma.',
    render: (c) => stroke(waveRing(148, 30, 3), c, 44),
  },
  {
    id: 'd',
    label: 'D · Anillo modulado, macizo',
    idea: 'La misma curva rellena. Pierde el detalle y gana silueta: es la que mejor aguanta abajo de todo.',
    render: (c) => `<path d="${waveRing(150, 32, 3)}" fill="${c}"/>`,
  },
  {
    id: 'e',
    label: 'E · Hélice',
    idea: 'Dos ondas en contrafase que se cruzan dos veces. Ida y vuelta en la misma forma.',
    render: (c) =>
      stroke(sineArc(132, 380, C, 62, 0), c, 40) + stroke(sineArc(132, 380, C, 62, Math.PI), c, 40),
  },
  {
    id: 'f',
    label: 'F · Entrelazado',
    idea: 'Dos anillos que se cruzan tejidos, uno por encima y otro por debajo. Conexión, sin metáfora.',
    render: (c, id) =>
      `<mask id="wv-${id}">
         <rect width="512" height="512" fill="white"/>
         <path d="M196 190A96 96 0 0 1 196 322" fill="none" stroke="black" stroke-width="76"/>
       </mask>
       <circle cx="196" cy="256" r="96" fill="none" stroke="${c}" stroke-width="40"/>
       <circle cx="316" cy="256" r="96" fill="none" stroke="${c}" stroke-width="40" mask="url(#wv-${id})"/>`,
  },
  {
    id: 'g',
    label: 'G · Abanico',
    idea: 'Arcos concéntricos con barrido creciente. El ritmo sale de una progresión, no del ojo.',
    render: (c) =>
      [
        [72, 70],
        [116, 120],
        [160, 170],
      ]
        .map(([r, sweep]) => {
          const a0 = (-sweep / 2) * (Math.PI / 180);
          const a1 = (sweep / 2) * (Math.PI / 180);
          const large = sweep > 180 ? 1 : 0;
          return stroke(
            `M${pt(C + r * Math.cos(a0), C + r * Math.sin(a0))}A${r} ${r} 0 ${large} 1 ${pt(
              C + r * Math.cos(a1),
              C + r * Math.sin(a1)
            )}`,
            c,
            38
          );
        })
        .join('') + `<circle cx="${C}" cy="${C}" r="34" fill="${c}"/>`,
  },
  {
    id: 'h',
    label: 'H · Lente',
    idea: 'Dos arcos del mismo radio que se cortan: la vesica de la geometría clásica. Dos partes que se encuentran.',
    render: (c) =>
      stroke('M256 136A150 150 0 0 0 256 376', c, 46) + stroke('M256 136A150 150 0 0 1 256 376', c, 46),
  },
  {
    id: 'i',
    label: 'I · Cinta',
    idea: 'Una sola onda gruesa que se cierra en anillo por un lado. Continuidad sin ser un círculo.',
    render: (c) =>
      stroke(spiral(64, 150, 0.72, Math.PI * 0.35) + spiral(150, 64, 0.72, Math.PI * 1.07).slice(1).replace(/^M/, 'L'), c, 46),
  },
];

const icon = (it, bg, fg, suffix = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">
     <rect width="512" height="512" rx="115" fill="${bg}"/>
     ${it.render(fg, it.id + suffix)}
   </svg>`;

const CELL_W = 560;
const CELL_H = 540;
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
  const H = rows * CELL_H + 140;

  const cells = INTERIORS.map((it, i) => {
    const x = (i % COLS) * CELL_W;
    const y = Math.floor(i / COLS) * CELL_H + 140;
    return `
    <g transform="translate(${x} ${y})">
      <rect x="20" y="14" width="${CELL_W - 40}" height="${CELL_H - 40}" rx="26"
            fill="#11161D" stroke="#1E2630" stroke-width="2"/>

      <svg x="150" y="42" width="260" height="260">${icon(it, BRAND, WHITE, '-b')}</svg>

      <svg x="56" y="326" width="48" height="48">${icon(it, BRAND, WHITE, '-1')}</svg>
      <svg x="120" y="334" width="32" height="32">${icon(it, BRAND, WHITE, '-2')}</svg>
      <svg x="168" y="338" width="24" height="24">${icon(it, BRAND, WHITE, '-3')}</svg>
      <svg x="208" y="342" width="16" height="16">${icon(it, BRAND, WHITE, '-4')}</svg>
      <svg x="248" y="326" width="48" height="48">${icon(it, INK, BRAND, '-5')}</svg>

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
    <text x="46" y="58" font-family="${FONT}" font-size="34" font-weight="700" fill="${WHITE}">fluws — forma por construcción</text>
    <text x="46" y="94" font-family="${FONT}" font-size="21" fill="${GRAY}">Espirales con progresión real, anillos modulados por seno, tangencias exactas. Nada aproximado a ojo.</text>
    <text x="46" y="124" font-family="${FONT}" font-size="19" fill="${GRAY}">Probadas a 48 · 32 · 24 · 16px reales, más la versión oscura para fondo claro.</text>
    ${cells}
  </svg>`;
}

(async () => {
  const outDir = process.argv[2] || 'scripts/out';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'simbolo-forma.png');
  await sharp(Buffer.from(sheet())).png().toFile(file);
  console.log('listo →', path.resolve(file));
})();
