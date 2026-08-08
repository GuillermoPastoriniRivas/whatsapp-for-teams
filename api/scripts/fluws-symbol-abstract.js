/* fluws: el contenedor está decidido (cuadrado redondeado verde), lo que se
   explora es qué va adentro.
   Correr desde api/ (sharp vive en api/node_modules):

     node scripts/fluws-symbol-abstract.js [carpeta]

   El cuadrado verde con una figura blanca adentro es lo que hereda del ícono
   de asis, y es lo único que la gente reconoce a tamaño de ícono. Queda fijo.

   Descartado hasta acá, y por qué, para no volver a proponerlo:
   - Burbuja de chat: literal, ata la marca a "chat" cuando vende automatización,
     y es territorio de Intercom.
   - Horquilla / bifurcación con trazo fino: es el glifo de compartir de iOS y
     Android, y encima se desintegra abajo de 32px.
   - Monograma "f": Facebook lo tiene tomado, y en un producto del ecosistema
     Meta la colisión es con la familia de al lado. Además es mudo.
   - Rombo simétrico: dice "pasa por acá", no dice "sale distinto".
   - Dos barras inclinadas: podría ser cualquier cosa.

   Lo que sobrevive: "muchos a uno" como idea, reconstruido con MASA. Más
   algunas alternativas abstractas que dicen algo del producto sin representar
   un objeto. */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BRAND = '#18C7A5';
const INK = '#0B0F14';
const WHITE = '#FFFFFF';
const GRAY = '#7C8896';

const VIEWBOX = '0 0 512 512';
/* Cuadrado redondeado de 512 con radio 115. Ojo con las cuatro esquinas: una
   versión anterior se comía el tramo `397 512H115` y la figura salía deformada
   sin que saltara ningún error, porque un path inválido igual renderiza. */
const SQUIRCLE =
  'M115 0H397A115 115 0 0 1 512 115V397A115 115 0 0 1 397 512H115A115 115 0 0 1 0 397V115A115 115 0 0 1 115 0Z';

const bar = (x, y, w, h, c) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2}" fill="${c}"/>`;

/* Cada interior se dibuja en el espacio de 512 del cuadrado, ocupando el centro
   con aire suficiente para que el radio del contenedor no se lo coma. */
const INTERIORS = [
  {
    id: 'a',
    label: 'A · Muchos a uno, macizo',
    idea: 'El concepto que te gustó, con trazo 34 y nodos llenos.',
    render: (c) =>
      `<g stroke="${c}" stroke-width="34" fill="none" stroke-linecap="round">
         <path d="M150 158C232 158 246 256 288 256"/>
         <path d="M150 256H288"/>
         <path d="M150 354C232 354 246 256 288 256"/>
       </g>
       <circle cx="140" cy="158" r="34" fill="${c}"/>
       <circle cx="140" cy="256" r="34" fill="${c}"/>
       <circle cx="140" cy="354" r="34" fill="${c}"/>
       <circle cx="330" cy="256" r="62" fill="${c}"/>`,
  },
  {
    id: 'b',
    label: 'B · El cuarto de vuelta',
    idea: 'Tres renglones dispersos se vuelven un bloque compacto.',
    render: (c) =>
      bar(120, 166, 148, 40, c) + bar(120, 236, 148, 40, c) + bar(120, 306, 100, 40, c) +
      bar(322, 150, 72, 212, c),
  },
  {
    id: 'c',
    label: 'C · Los canales atraviesan',
    idea: 'Muchos a uno en negativo, cortando el cuadrado de lado a lado.',
    cut: true,
    render: (c) =>
      `<g stroke="${c}" stroke-width="52" fill="none">
         <path d="M-20 148C150 148 168 256 268 256"/>
         <path d="M-20 256H268"/>
         <path d="M-20 364C150 364 168 256 268 256"/>
         <path d="M268 256H532"/>
       </g>`,
  },
  {
    id: 'd',
    label: 'D · Siempre encendido',
    idea: 'Un ciclo que no cierra: atiende 24/7 y queda una puerta abierta.',
    render: (c) =>
      `<path d="M256 132a124 124 0 1 0 88 36" fill="none" stroke="${c}" stroke-width="62" stroke-linecap="round"/>
       <circle cx="366" cy="146" r="42" fill="${c}"/>`,
  },
  {
    id: 'e',
    label: 'E · La respuesta',
    idea: 'Entra una pregunta chica, vuelve una respuesta que pesa.',
    render: (c) =>
      `<g fill="none" stroke="${c}" stroke-linecap="round">
         <path d="M212 174A106 106 0 0 0 212 338" stroke-width="34"/>
         <path d="M296 140A150 150 0 0 1 296 372" stroke-width="62"/>
       </g>`,
  },
  {
    id: 'f',
    label: 'F · El pliegue',
    idea: 'El flujo dobla. No representa nada: solo cambia de dirección.',
    render: (c) =>
      `<path d="M150 186H262a52 52 0 0 1 52 52v90" fill="none" stroke="${c}" stroke-width="76"
             stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'g',
    label: 'G · La escala',
    idea: 'Nueve unidades chicas, un resultado grande. Sin conectores.',
    render: (c) =>
      [0, 1, 2]
        .flatMap((r) => [0, 1, 2].map((k) => bar(132 + k * 58, 168 + r * 62, 40, 40, c)))
        .join('') + bar(320, 168, 62, 164, c),
  },
  {
    id: 'h',
    label: 'H · La onda',
    idea: 'Un ciclo completo: fluir, sin decir nada más.',
    render: (c) =>
      `<path d="M140 256C168 190 224 190 256 256C288 322 344 322 372 256" fill="none"
             stroke="${c}" stroke-width="62" stroke-linecap="round"/>`,
  },
  {
    id: 'i',
    label: 'I · El núcleo en órbita',
    idea: 'Algo estable en el centro y todo lo demás girando alrededor.',
    render: (c) =>
      `<circle cx="256" cy="256" r="52" fill="${c}"/>
       <path d="M256 120a136 136 0 0 1 0 272" fill="none" stroke="${c}" stroke-width="46" stroke-linecap="round"/>`,
  },
];

/** El ícono: cuadrado verde con la figura blanca. `cut` lo dibuja al revés —
 *  la figura cala el cuadrado y deja pasar el fondo. */
const icon = (it, bg, fg, suffix) =>
  it.cut
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">
         <mask id="mk-${it.id}${suffix}">
           <rect width="512" height="512" fill="white"/>
           ${it.render('black')}
         </mask>
         <path d="${SQUIRCLE}" fill="${bg}" mask="url(#mk-${it.id}${suffix})"/>
       </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">
         <rect width="512" height="512" rx="115" fill="${bg}"/>
         ${it.render(fg)}
       </svg>`;

const CELL_W = 560;
const CELL_H = 520;
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
  const H = rows * CELL_H + 130;

  const cells = INTERIORS.map((it, i) => {
    const x = (i % COLS) * CELL_W;
    const y = Math.floor(i / COLS) * CELL_H + 130;
    return `
    <g transform="translate(${x} ${y})">
      <rect x="20" y="14" width="${CELL_W - 40}" height="${CELL_H - 40}" rx="26"
            fill="#11161D" stroke="#1E2630" stroke-width="2"/>

      <svg x="150" y="42" width="260" height="260">${icon(it, BRAND, WHITE, '-big')}</svg>

      <!-- Prueba del entrecerrar los ojos: 48 · 32 · 24 · 16px reales -->
      <svg x="56" y="326" width="48" height="48">${icon(it, BRAND, WHITE, '-s1')}</svg>
      <svg x="120" y="334" width="32" height="32">${icon(it, BRAND, WHITE, '-s2')}</svg>
      <svg x="168" y="338" width="24" height="24">${icon(it, BRAND, WHITE, '-s3')}</svg>
      <svg x="208" y="342" width="16" height="16">${icon(it, BRAND, WHITE, '-s4')}</svg>
      <!-- Y la versión oscura, para fondo claro -->
      <svg x="248" y="326" width="48" height="48">${icon(it, INK, BRAND, '-d1')}</svg>

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
    <text x="46" y="58" font-family="${FONT}" font-size="34" font-weight="700" fill="${WHITE}">fluws — el cuadrado está fijo, se decide qué va adentro</text>
    <text x="46" y="92" font-family="${FONT}" font-size="21" fill="${GRAY}">Sin burbuja, sin monograma, sin trazo fino. Cada figura dice algo del producto sin representar un objeto.</text>
    <text x="46" y="120" font-family="${FONT}" font-size="19" fill="${GRAY}">Probadas a 48 · 32 · 24 · 16px reales, más la versión oscura para fondo claro.</text>
    ${cells}
  </svg>`;
}

(async () => {
  const outDir = process.argv[2] || 'scripts/out';
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'simbolo-abstracto.png');
  await sharp(Buffer.from(sheet())).png().toFile(file);
  console.log('listo →', path.resolve(file));
})();
