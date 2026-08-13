/* Marca asis.chat: núcleo macizo + órbita de 317°.
 *
 * La forma salió de una exploración larga y conviene saber qué NO volver a
 * proponer, porque cada una se descartó por un motivo concreto:
 * burbuja de chat (literal, y es territorio de Intercom), horquilla o
 * bifurcación (es el glifo de compartir de iOS y Android), monograma "f"
 * (Facebook, y en un producto del ecosistema Meta la colisión es con la
 * familia de al lado), barras de señal limpias (es el ícono de cobertura de la
 * barra de estado del teléfono), abanico de arcos (wifi y RSS), y patita de
 * burbuja sobre este mismo anillo (queda una lupa, o un pin de mapa).
 *
 * El color va PLANO, no en degradado: así lo define el brand board. */

import { useId } from "react";

/* Espacio de 512.
 *
 * La órbita barre 323.3° y deja la boca EN FRENTE de la patita: centrada en
 * 316°, entre 297.6° y 334.4° (en SVG el ángulo crece hacia abajo, así que 270°
 * es arriba). Las puntas del arco caen en (388.5, 192.4) y (324.3, 125.8).
 *
 * Casi cerrada a propósito: con la boca más ancha lee como anillo roto o como
 * spinner de carga, y cerrada del todo lee como el punto de grabar.
 *
 * CUÁNTO ABRE NO ES UN ÁNGULO ELEGIDO. Lo que se elige es el AIRE que se ve
 * entre las dos puntas, y va con la misma regla que gobierna el hueco del
 * núcleo, así que el símbolo tiene un solo criterio de contraforma:
 *
 *     aire = φ × trazo = 1.618 × 36 = 58.2
 *
 * Los caps son redondos y se comen medio trazo por punta, así que el hueco del
 * arco medido sobre el eje es 58.2 + 36 = 94.2, y de ahí sale el ángulo:
 * 94.2 / 147 = 0.641 rad = 36.7°. Los 43° que hubo hasta ago-2026 dejaban 74.3
 * de aire y la boca leía demasiado abierta.
 *
 * O sea que el ángulo DEPENDE DEL RADIO DEL EJE y del trazo. Si cambia
 * cualquiera de los dos, se recalcula con la fórmula; copiar los 36.7° a otro
 * radio cambia el aire sin que se note por qué.
 *
 * OJO CON EL RADIO. Lo fijo del símbolo es el BORDE EXTERIOR, en r=165, porque
 * es lo que define el tamaño total. El radio del eje es una consecuencia:
 *
 *     eje = 165 − trazo/2
 *
 * O sea que afinar el trazo NO achica el logo: engorda el hueco. Si se cambia
 * el trazo hay que recalcular el eje Y las dos puntas del arco con ese eje;
 * dejar el 147 y solo tocar el ancho corre el borde exterior y cambia el
 * tamaño del símbolo sin que nadie lo pida. */
const ORBIT_PATH = "M388.5 192.4A147 147 0 1 1 324.3 125.8";
const ORBIT_STROKE = 36;

/* EL SISTEMA DE PROPORCIONES. Leer esto antes de tocar cualquier radio.
 *
 * El símbolo es una burbuja adentro de otra, y el tamaño de la de adentro NO se
 * elige a ojo: sale de una regla, y de la regla sale UNA constante k que gobierna
 * toda la burbuja interior — radio y patita — en vez de ser dos decisiones
 * sueltas que se desincronizan.
 *
 * La regla es la del contraste tipográfico entre contraforma y asta:
 *
 *     hueco = φ × trazo = 1.618 × 36 = 58.2
 *     núcleo = 129 − 58.2 = 70.8          k = 70.8 / 165 = 0.4291
 *
 * De ahí caen las tres medidas concéntricas, hacia adentro desde 165:
 *
 *     banda   165 → 129   (36, el trazo)
 *     hueco   129 →  70.8 (58.2)
 *     núcleo   70.8 →  0
 *
 * Se evaluaron y descartaron, cada una por su motivo:
 *
 * · k = 1/φ² = 0.382, o sea reducir la burbuja de afuera dos veces por la
 *   sección áurea (núcleo 63). Es la que estuvo hasta ago-2026 y la más limpia
 *   de derivar, pero el núcleo lee chico: es el acento del símbolo y a esa
 *   escala no sostiene el centro. Se cambió por eso.
 * · núcleo = hueco (64.5). El unísono 1:1 no crea jerarquía entre las partes.
 * · continuación geométrica pura, núcleo = 129 × (129/165) = 101. Es la que
 *   seguiría la progresión del anillo, pero deja el hueco en 28, más fino que
 *   el trazo de 36, y una contraforma más delgada que el asta lee apretada.
 *
 * El 73 que hubo antes venía de igualar hueco y trazo cuando el trazo era 46;
 * al pasar el trazo a 36 esa coincidencia dejó de existir y el número quedó
 * huérfano. Por eso este bloque.
 *
 * OJO: el hueco depende del trazo. Si el trazo cambia, el núcleo se recalcula
 * con la fórmula de arriba, no se deja el 70.8. */
const CORE_R = 70.8;

/* La patita del núcleo: el núcleo también es una burbuja, una adentro de la
 * otra.
 *
 * NO está puesta a ojo. Es la patita grande pasada por la MISMA homotecia que
 * fija el radio del núcleo: k = 0.4291, desde el centro. Una homotecia conserva
 * direcciones, así que las aristas salen paralelas a las de la patita grande y a
 * las del corte sin tener que forzarlo, y el núcleo queda siendo un modelo a
 * escala exacto de la burbuja grande: sobresale un 34.5% de su radio, igual que
 * la grande sobresale del anillo.
 *
 * Punta en r=95.3 y base en r=64.3, adentro del núcleo. Vive entera en el hueco
 * de 70.8 a 129, con 29.8 de aire hasta la banda. Aun así no sobrevive por
 * debajo de 28px: a 20 y a 16 solo deforma un poco el círculo, y está bien — a
 * ese tamaño el símbolo se reconoce por la silueta, no por el interior.
 *
 * Con la punta en 99.2 contando el trazo, sigue sin tocar el corte del anillo,
 * que arranca en 115. Ese margen es el que permite dejar el núcleo FUERA de la
 * máscara; si el núcleo crece más, hay que volver a chequearlo.
 *
 * Si se cambia el radio del núcleo o el trazo del anillo, esto se recalcula con
 * la misma k, no se ajusta a mano. */
const CORE_TAIL_PATH = "M225.8 312.8L187.5 322.2L199.2 286.2Z";
const CORE_TAIL_STROKE = 7.7; // = TAIL_STROKE × 0.4291

/* La patita, abajo a la izquierda. Es un triángulo con la base APOYADA SOBRE LA
 * BANDA del trazo de la órbita (los dos vértices de la base están a r=150, y la
 * banda va de 129 a 165), así queda fundida con el anillo en vez de pegada.
 *
 * Esto pone un piso al afinado del anillo: con un trazo tal que el borde
 * interno pase de 150, la base deja de estar apoyada y la patita queda colgando
 * por fuera. Ese piso es trazo 30.
 *
 * Vértices en polares desde el centro: base a 118° y 152° con r=150, punta a
 * 136° con r=222.
 *
 * Se dibuja con relleno Y trazo del mismo color: es la forma más simple de
 * redondearle las esquinas a un triángulo en SVG, y deja la patita con el mismo
 * acabado que los caps redondos de la órbita. */
const TAIL_PATH = "M185.6 388.4L96.3 410.2L123.6 326.4Z";
const TAIL_STROKE = 18;

/* Bbox real, contando los caps de la órbita y el trazo de la patita:
   x 87.3→421, y 91→421. El viewBox de `mark` lo encuadra con un respiro
   de 6. */
const MARK_VIEWBOX = "81 85 346 342";

/* Escala del glifo dentro del cuadrado verde de la variante `app`.
 *
 * Sin escalar el glifo va de 91 a 421 sobre 512, o sea el 64.5% del lado y 17.8%
 * de aire por borde: correcto para una guía de íconos, pero el símbolo lee chico
 * y flotando adentro del cuadrado. Con 1.12 pasa a ocupar el 72% con 14% de
 * aire, que sigue entrando en la banda de contenido de las guías y deja el
 * radio de 115 sin morder el glifo.
 *
 * Es el mismo número que espeja `scripts/generate-icons.cjs`. Si se toca acá,
 * se toca allá y se regeneran los íconos. */
const APP_GLYPH_SCALE = 1.12;

/* El corte del anillo debajo de la patita.
 *
 * La banda del anillo se interrumpe ahí, así que el hueco interior sale hasta
 * la base de la patita. Eso es lo que se ve como un triángulo del color de
 * fondo pegado al arco, y es lo que hace que la patita lea como la cola de una
 * burbuja y no como un triángulo pegado a un anillo.
 *
 * Es un triángulo SEMEJANTE a la patita: aristas paralelas a las suyas, así que
 * hereda su ángulo de punta (58.2°), y apunta para el mismo lado, hacia afuera
 * sobre el eje de 136°. Punta en r=163, base de 53.8 sobre r≈115.
 *
 * LA PUNTA ES EL ÚNICO NÚMERO QUE SE ELIGE. La base del triángulo vive adentro
 * del hueco, o sea abajo de r=129, así que no se ve: agrandarla no agranda nada.
 * Lo que se ve es la cuña entre el borde del hueco y la punta, y con el ángulo
 * fijo en 58.2° esa cuña la define sola la punta:
 *
 *     ancho visible = 2 × (punta − 129) × tan(29.1°)
 *     hoy = 2 × 34 × 0.557 = 37.9
 *
 * Con la punta en 156 que hubo hasta ago-2026 daban 30.1 y la cuña leía apretada
 * contra la patita. Escalar el triángulo desde su propia punta no habría hecho
 * NADA visible: mismo ángulo, misma cuña.
 *
 * El ancho de la base sale solo: con el ángulo fijo, ancho = 1.114 × largo. No
 * son dos números independientes. El 46 que hubo antes venía de igualar el trazo
 * del anillo cuando el trazo era 46, y quedó huérfano al bajar el trazo a 36.
 *
 * Las dos condiciones que lo sostienen, y que hay que rehacer si se toca:
 *
 * 1. Las ESQUINAS de la base tienen que caer dentro del borde interno de la
 *    banda, para que el corte se funda con el hueco. Van en r=117.8 contra una
 *    banda que arranca en 129: 11.2 de margen. Por eso al alargar el triángulo
 *    se dejó la base clavada en r≈115 y se movió solo la punta — corriendo el
 *    triángulo entero hacia afuera, el margen bajaba a 5 y aparecía una costura
 *    de banda entre el corte y el hueco.
 * 2. La PUNTA tiene que pasar la cuerda de la base de la patita, que a estos
 *    ángulos cae en r≈143. Va en 163, y por eso separa el anillo de la patita
 *    en vez de solo adelgazarlo. Tope por arriba: la patita llega hasta r=222,
 *    así que la punta puede seguir creciendo sin partir nada, pero pasando ~185
 *    la cuña se come la base de la patita y la deja colgando de dos puntas.
 *
 * La orientación importa. Al revés —ancho hacia afuera— la patita queda
 * enganchada al anillo por el lado ancho y el corte lee como una mordida.
 *
 * Va como máscara y no como camino con `evenodd`: la patita se dibuja con
 * relleno Y trazo de 18, y un agujero en el relleno quedaría tapado por el
 * trazo. La máscara recorta el resultado ya compuesto. */
const CUT_PATH = "M138.8 369.2L154.8 316.3L192.2 355Z";

/**
 * Verde del LOGO.
 *
 * OJO: ya NO coincide con el `--primary` de la interfaz, que es
 * `oklch(0.525 0.110 165)` = `#027E5A`. Se despegaron a propósito: el logo tira
 * más al teal, hacia el verde histórico de asis, y la interfaz se queda en el
 * esmeralda más oscuro, que es el único que aguanta texto blanco encima.
 *
 * O sea que el logo va a verse un tono distinto de los botones, y está bien.
 * Si alguien los "sincroniza", rompe una de las dos cosas.
 *
 * Va fijo y no como token: es el ícono de la marca y no cambia con el tema.
 * Excepción deliberada a la regla de solo-tokens de DESIGN.md.
 */
export const ASIS_GREEN = "#15A58A";
/** Negro de marca. También el color del wordmark sobre fondo claro. */
export const ASIS_INK = "#0B0F14";

interface AsisLogoProps {
  size?: number;
  className?: string;
  /**
   * "mark" = el símbolo suelto en el verde de marca, sobre transparente.
   * "mono" = el mismo símbolo en `currentColor`, para fondos de color donde el
   *          verde desaparecería contra el fondo (el panel de auth). Se tiñe
   *          con `text-*`.
   * "app"  = el símbolo blanco sobre el cuadrado verde. Es el ícono de la
   *          app, y es lo que hereda del logo de asis: cuadrado de color con
   *          una forma blanca adentro.
   */
  variant?: "mark" | "mono" | "app";
}

function Glyph({ color }: { color: string }) {
  // `useId` trae dos puntos (":r1:") y eso rompe como selector CSS; dentro de un
  // `url(#…)` de SVG funciona igual, pero se limpian para no dejar la trampa.
  const maskId = `asis-cut-${useId().replace(/:/g, "")}`;

  return (
    <>
      <mask
        id={maskId}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="512"
        height="512"
      >
        <rect width="512" height="512" fill="#fff" />
        <path d={CUT_PATH} fill="#000" />
      </mask>
      {/* El núcleo y su patita quedan FUERA de la máscara: el corte no debe
          tocarlos. Igual no se cruzan —el corte vive de r=115 a r=156 y la
          patita del núcleo no pasa de r=88— pero dejarlos adentro haría que
          mover el corte los mordiera sin que se note por qué. */}
      <g mask={`url(#${maskId})`}>
        <path
          d={ORBIT_PATH}
          fill="none"
          stroke={color}
          strokeWidth={ORBIT_STROKE}
          strokeLinecap="round"
        />
        <path
          d={TAIL_PATH}
          fill={color}
          stroke={color}
          strokeWidth={TAIL_STROKE}
          strokeLinejoin="round"
        />
      </g>
      <path
        d={CORE_TAIL_PATH}
        fill={color}
        stroke={color}
        strokeWidth={CORE_TAIL_STROKE}
        strokeLinejoin="round"
      />
      <circle cx="256" cy="256" r={CORE_R} fill={color} />
    </>
  );
}

export function AsisLogo({ size = 40, className, variant = "mark" }: AsisLogoProps) {
  if (variant === "app") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <rect width="512" height="512" rx="115" fill={ASIS_GREEN} />
        <g
          transform={`translate(256 256) scale(${APP_GLYPH_SCALE}) translate(-256 -256)`}
        >
          <Glyph color="#FFFFFF" />
        </g>
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={MARK_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <Glyph color={variant === "mono" ? "currentColor" : ASIS_GREEN} />
    </svg>
  );
}
