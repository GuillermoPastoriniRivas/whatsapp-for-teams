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
 * La órbita barre 317° y deja la boca EN FRENTE de la patita: centrada en 316°,
 * entre 294.5° y 337.5° (en SVG el
 * ángulo crece hacia abajo, así que 270° es arriba). Las puntas del arco caen
 * en (391.8, 199.8) y (317, 122.2).
 *
 * Casi cerrada a propósito: con la boca más ancha lee como anillo roto o como
 * spinner de carga, y cerrada del todo lee como el punto de grabar.
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
const ORBIT_PATH = "M391.8 199.8A147 147 0 1 1 317 122.2";
const ORBIT_STROKE = 36;

/* EL SISTEMA DE PROPORCIONES. Leer esto antes de tocar cualquier radio.
 *
 * El símbolo es una burbuja adentro de otra, y el tamaño de la de adentro NO se
 * elige a ojo: sale de reducir la de afuera dos veces por la sección áurea.
 *
 *     k = 1/φ² = 0.382          núcleo = 165 × k = 63.02
 *
 * Ese mismo k genera la patita del núcleo (ver abajo), así que UNA constante
 * gobierna toda la burbuja interior — radio y patita — en vez de ser dos
 * decisiones sueltas que se desincronizan.
 *
 * De ahí caen las tres medidas concéntricas, hacia adentro desde 165:
 *
 *     banda   165 → 129   (36, el trazo)
 *     hueco   129 →  63   (66)
 *     núcleo   63 →   0
 *
 * Se evaluaron y descartaron, cada una por su motivo:
 *
 * · hueco = φ × trazo (núcleo 70.8). Regla tipográfica válida de contraforma
 *   contra asta, pero gobierna el hueco y deja el núcleo como resto. El núcleo
 *   es el acento del símbolo; no puede ser lo que sobra.
 * · núcleo = hueco (64.5). El unísono 1:1 no crea jerarquía entre las partes.
 * · continuación geométrica pura, núcleo = 129 × (129/165) = 101. Es la que
 *   seguiría la progresión del anillo, pero deja el hueco en 28, más fino que
 *   el trazo de 36, y una contraforma más delgada que el asta lee apretada.
 *
 * El 73 que hubo antes venía de igualar hueco y trazo cuando el trazo era 46;
 * al pasar el trazo a 36 esa coincidencia dejó de existir y el número quedó
 * huérfano. Por eso este bloque. */
const CORE_R = 63;

/* La patita del núcleo: el núcleo también es una burbuja, una adentro de la
 * otra.
 *
 * NO está puesta a ojo. Es la patita grande pasada por la MISMA homotecia que
 * fija el radio del núcleo: k = 1/φ² = 0.382, desde el centro. Una homotecia
 * conserva direcciones, así que las aristas salen paralelas a las de la patita
 * grande y a las del corte sin tener que forzarlo, y el núcleo queda siendo un
 * modelo a escala exacto de la burbuja grande: sobresale un 34.5% de su radio,
 * igual que la grande sobresale del anillo.
 *
 * Punta en r=84.8 y base en r=57.3, adentro del núcleo. Vive entera en el hueco
 * de 63 a 129, con 40.8 de aire hasta la banda. Aun así no sobrevive por debajo
 * de 28px: a 20 y a 16 solo deforma un poco el círculo, y está bien — a ese
 * tamaño el símbolo se reconoce por la silueta, no por el interior.
 *
 * Si se cambia el radio del núcleo o el trazo del anillo, esto se recalcula con
 * la misma k, no se ajusta a mano. */
const CORE_TAIL_PATH = "M229.1 306.6L195 314.9L205.5 282.9Z";
const CORE_TAIL_STROKE = 6.9; // = TAIL_STROKE × 0.382

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

/* El corte del anillo debajo de la patita.
 *
 * La banda del anillo se interrumpe ahí, así que el hueco interior sale hasta
 * la base de la patita. Eso es lo que se ve como un triángulo del color de
 * fondo pegado al arco, y es lo que hace que la patita lea como la cola de una
 * burbuja y no como un triángulo pegado a un anillo.
 *
 * Es un triángulo SEMEJANTE a la patita: aristas paralelas a las suyas, así que
 * hereda su ángulo de punta (58.2°), y apunta para el mismo lado, hacia afuera
 * sobre el eje de 136°. Punta en r=156, base de 46 sobre r≈115.
 *
 * Ese 46 salió de igualar el trazo del anillo, cuando el trazo era 46. Ahora el
 * trazo es 36 y el corte se dejó en 46 a propósito: bajarlo lo acortaría —ancho
 * y largo están atados, ver abajo— y la patita se volvería a pegar al anillo.
 *
 * Con las aristas paralelas el ángulo queda fijo, o sea que el ancho ya define
 * el largo: 46 de ancho son 41.3 de largo. No son dos números independientes.
 *
 * Las dos condiciones que lo sostienen, y que hay que rehacer si se toca:
 *
 * 1. Las ESQUINAS de la base tienen que caer dentro del borde interno de la
 *    banda, para que el corte se funda con el hueco. Van en r=117 contra una
 *    banda que arranca en 129: 12 de margen. Con el trazo de 46 que había antes
 *    la banda arrancaba en 119 y el margen era de 2, así que si el trazo vuelve
 *    a engordar esto es lo primero que se rompe, y se rompe como una costura de
 *    banda entre el corte y el hueco.
 * 2. La PUNTA tiene que pasar la cuerda de la base de la patita, que a estos
 *    ángulos cae en r≈143. Va en 156, y por eso separa el anillo de la patita
 *    en vez de solo adelgazarlo.
 *
 * La orientación importa. Al revés —ancho hacia afuera— la patita queda
 * enganchada al anillo por el lado ancho y el corte lee como una mordida.
 *
 * Va como máscara y no como camino con `evenodd`: la patita se dibuja con
 * relleno Y trazo de 18, y un agujero en el relleno quedaría tapado por el
 * trazo. La máscara recorta el resultado ya compuesto. */
const CUT_PATH = "M143.8 364.4L157.5 319.2L189.5 352.2Z";

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
        {/* Sin escalar: el glifo ocupa 91→421 de 512, que deja el aire justo
            para que el radio del contenedor no se lo coma. */}
        <Glyph color="#FFFFFF" />
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
