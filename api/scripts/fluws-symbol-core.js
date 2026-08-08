/* fluws: la familia definitiva — núcleo + curva.
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/fluws-symbol-core.js [carpeta]

   POR QUÉ ESTA FAMILIA. Dos exploraciones independientes cayeron en la misma
   forma: la "Órbita" de la tanda telecom (elegida por vocabulario de rubro) y
   la "Espiral con núcleo" de la tanda de construcción (elegida por belleza
   formal). Núcleo macizo + curva alrededor. Cuando dos criterios distintos
   convergen, ahí está el logo.

   Esto ya no abre direcciones: son variaciones finas de una sola idea, que es
   como se cierra un símbolo. Se mueven cuatro parámetros —radio del núcleo,
   barrido de la curva, si el radio crece o es constante, y si el ancho del
   trazo es parejo o cónico— y nada más.

   La banda cónica (H, I) se calcula: se muestrea la espiral, se saca la normal
   en cada punto y se ofsetea a los dos lados con un ancho que varía. Es un
   polígono relleno, no un trazo, porque SVG no sabe variar stroke-width a lo
   largo de un path. Es la pieza más "resuelta" del set y la más difícil de
   copiar a ojo. */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BRAND = '#18C7A5';
const INK = '#0B0F14';
const WHITE = '#FFFFFF';
const GRAY = '#7C8896';

const VIEWBOX = '0 0 512 512';
const C = 256;
const TAU = Math.PI * 2;

const f = (n) => n.toFixed(1);
const pt = (x, y) => `${f(x)} ${f(y)}`;

/** Arco de círculo por ángulos, en grados. */
function arc(r, degFrom, degTo) {
  const a0 = (degFrom * Math.PI) / 180;
  const a1 = (degTo * Math.PI) / 180;
  const large = Math.abs(degTo - degFrom) > 180 ? 1 : 0;
  const sweep = degTo > degFrom ? 1 : 0;
  return `M${pt(C + r * Math.cos(a0), C + r * Math.sin(a0))}A${r} ${r} 0 ${large} ${sweep} ${pt(
    C + r * Math.cos(a1),
    C + r * Math.sin(a1)
  )}`;
}

/** Espiral arquimediana muestreada. */
function spiral(r0, r1, turns, phase, steps = 200) {
  const p = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = phase + t * turns * TAU;
    const r = r0 + (r1 - r0) * t;
    p.push(pt(C + r * Math.cos(a), C + r * Math.sin(a)));
  }
  return 'M' + p.join('L');
}

/**
 * Banda cónica sobre una espiral: ancho que va de w0 a w1.
 * Se ofsetea cada muestra sobre su normal y se cierra el polígono con dos
 * semicírculos como tapas, para que las puntas queden redondas igual que un
 * stroke-linecap="round".
 */
function taperedSpiral(r0, r1, turns, phase, w0, w1, steps = 220) {
  const outer = [];
  const inner = [];
  const dr = (r1 - r0) / (turns * TAU); // dr/dángulo
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = phase + t * turns * TAU;
    const r = r0 + (r1 - r0) * t;
    const x = C + r * Math.cos(a);
    const y = C + r * Math.sin(a);
    // Tangente de la espiral en coordenadas polares.
    let tx = dr * Math.cos(a) - r * Math.sin(a);
    let ty = dr * Math.sin(a) + r * Math.cos(a);
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const w = (w0 + (w1 - w0) * t) / 2;
    outer.push([x - ty * w, y + tx * w]);
    inner.push([x + ty * w, y - tx * w]);
  }
  const capEnd = (w1 / 2).toFixed(1);
  const capStart = (w0 / 2).toFixed(1);
  const last = outer.length - 1;
  return (
    'M' + outer.map(([x, y]) => pt(x, y)).join('L') +
    `A${capEnd} ${capEnd} 0 0 1 ${pt(inner[last][0], inner[last][1])}` +
    'L' + inner.slice().reverse().map(([x, y]) => pt(x, y)).join('L') +
    `A${capStart} ${capStart} 0 0 1 ${pt(outer[0][0], outer[0][1])}Z`
  );
}

const line = (d, c, w) =>
  `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
const core = (r, c) => `<circle cx="${C}" cy="${C}" r="${r}" fill="${c}"/>`;

const VARIANTS = [
  {
    id: 'a',
    label: 'A · Órbita cerrada',
    idea: 'Anillo completo. La más estable y la más neutra de la familia.',
    render: (c) => core(56, c) + line(arc(148, 0, 359.9), c, 42),
  },
  {
    id: 'b',
    label: 'B · Órbita 270°',
    idea: 'La que elegiste en la tanda telecom. Tres cuartos de vuelta, núcleo mediano.',
    render: (c) => core(54, c) + line(arc(140, -90, 180), c, 46),
  },
  {
    id: 'c',
    label: 'C · Órbita 270°, núcleo grande',
    idea: 'El peso se va al centro: manda el núcleo y la órbita lo acompaña.',
    render: (c) => core(78, c) + line(arc(152, -90, 180), c, 36),
  },
  {
    id: 'd',
    label: 'D · Órbita 270°, arco grueso',
    idea: 'Al revés: núcleo chico y órbita dominante. Más gráfico, menos "planeta".',
    render: (c) => core(38, c) + line(arc(136, -90, 180), c, 62),
  },
  {
    id: 'e',
    label: 'E · Órbita 320°',
    idea: 'Casi cerrada. La boca angosta genera tensión sin parecer un anillo roto.',
    render: (c) => core(54, c) + line(arc(142, -70, 250), c, 46),
  },
  {
    id: 'f',
    label: 'F · Espiral de una vuelta',
    idea: 'El radio crece parejo: la curva no vuelve al punto de partida.',
    render: (c) => core(48, c) + line(spiral(96, 168, 1, Math.PI * 1.1), c, 42),
  },
  {
    id: 'g',
    label: 'G · Espiral de vuelta y media',
    idea: 'Más recorrido, más envolvente. El núcleo queda contenido.',
    render: (c) => core(44, c) + line(spiral(84, 172, 1.5, Math.PI * 1.1), c, 38),
  },
  {
    id: 'h',
    label: 'H · Banda cónica, abriendo',
    idea: 'El ancho crece con el recorrido: arranca fino en el núcleo y sale grueso.',
    render: (c) => core(46, c) + `<path d="${taperedSpiral(92, 170, 1.05, Math.PI * 1.1, 18, 58)}" fill="${c}"/>`,
  },
  {
    id: 'i',
    label: 'I · Banda cónica, cerrando',
    idea: 'Al revés: entra ancha y se afina. Lee como algo que converge en el centro.',
    render: (c) => core(46, c) + `<path d="${taperedSpiral(92, 170, 1.05, Math.PI * 1.1, 58, 18)}" fill="${c}"/>`,
  },
  {
    id: 'j',
    label: 'J · Núcleo con dos órbitas',
    idea: 'Dos barridos distintos sobre el mismo centro. Ritmo, sin romper la simetría.',
    render: (c) => core(46, c) + line(arc(102, -60, 150), c, 32) + line(arc(164, 40, 300), c, 40),
  },
];

const icon = (v, bg, fg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">
     <rect width="512" height="512" rx="115" fill="${bg}"/>${v.render(fg)}
   </svg>`;

const CELL_W = 560;
const CELL_H = 520;
const COLS = 5;
const FONT = 'Segoe UI, Arial, sans-serif';

function wrap(text, max) {
  const lines = [''];
  for (const word of text.split(' ')) {
    const l = lines[lines.length - 1];
    if (l && (l + ' ' + word).length > max) lines.push(word);
    else lines[lines.length - 1] = l ? l + ' ' + word : word;
  }
  return lines;
}

function sheet() {
  const rows = Math.ceil(VARIANTS.length / COLS);
  const W = COLS * CELL_W;
  const H = rows * CELL_H + 140;

  const cells = VARIANTS.map((v, i) => {
    const x = (i % COLS) * CELL_W;
    const y = Math.floor(i / COLS) * CELL_H + 140;
    return `
    <g transform="translate(${x} ${y})">
      <rect x="20" y="14" width="${CELL_W - 40}" height="${CELL_H - 40}" rx="26"
            fill="#11161D" stroke="#1E2630" stroke-width="2"/>
      <svg x="150" y="42" width="260" height="260">${icon(v, BRAND, WHITE)}</svg>
      <svg x="56" y="326" width="48" height="48">${icon(v, BRAND, WHITE)}</svg>
      <svg x="120" y="334" width="32" height="32">${icon(v, BRAND, WHITE)}</svg>
      <svg x="168" y="338" width="24" height="24">${icon(v, BRAND, WHITE)}</svg>
      <svg x="208" y="342" width="16" height="16">${icon(v, BRAND, WHITE)}</svg>
      <svg x="248" y="326" width="48" height="48">${icon(v, INK, BRAND)}</svg>
      <text x="56" y="416" font-family="${FONT}" font-size="24" font-weight="600" fill="${WHITE}">${v.label}</text>
      ${wrap(v.idea, 56)
        .map((l, n) => `<text x="56" y="${446 + n * 24}" font-family="${FONT}" font-size="18" fill="${GRAY}">${l}</text>`)
        .join('')}
    </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <text x="46" y="58" font-family="${FONT}" font-size="34" font-weight="700" fill="${WHITE}">fluws — núcleo + curva</text>
    <text x="46" y="94" font-family="${FONT}" font-size="21" fill="${GRAY}">Una sola idea, diez variaciones. Se mueven radio del núcleo, barrido, si el radio crece, y si el ancho es parejo o cónico.</text>
    <text x="46" y="124" font-family="${FONT}" font-size="19" fill="${GRAY}">Probadas a 48 · 32 · 24 · 16px reales, más la versión oscura para fondo claro.</text>
    ${cells}
  </svg>`;
}

(async () => {
  const outDir = process.argv[2] || 'scripts/out';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'simbolo-nucleo.png');
  await sharp(Buffer.from(sheet())).png().toFile(file);
  console.log('listo →', path.resolve(file));
})();
