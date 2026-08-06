/**
 * Identificacion legal del titular de asis.chat.
 *
 * El nombre legal tiene que estar visible en el sitio publico: la verificacion
 * de negocio de Meta rechaza el dominio si no puede atarlo a la persona que
 * figura en la documentacion presentada ("your legal business name must be
 * present on the website"). Vive en un solo lugar para que el nombre que ve
 * Meta sea identico en la landing, la politica de privacidad y los terminos —
 * una discrepancia entre paginas es motivo de rechazo.
 *
 * Los valores salen de la constancia de inscripcion en el RUT (DGI) que se le
 * presento a Meta. `name` respeta la denominacion tal cual figura ahi
 * (apellidos primero); no se "normaliza" a orden natural porque el nombre
 * legal es el de la constancia y los tres lados —constancia, portfolio de
 * Meta y sitio— tienen que decir lo mismo.
 */
export const LEGAL_ENTITY = {
  name: "Pastorini Rivas Guillermo Rene",
  /**
   * Vacio a proposito: el domicilio fiscal es particular y Meta no lo exige en
   * el sitio — le alcanza con la constancia de DGI que ya tiene. Si algun dia
   * hay una direccion comercial, va aca y aparece sola en todas las paginas.
   */
  address: "",
  taxId: "150788960019",
} as const;

/** Nombre legal seguido de los datos opcionales que esten cargados. */
export function legalEntityLine(): string {
  return [
    LEGAL_ENTITY.name,
    LEGAL_ENTITY.address,
    LEGAL_ENTITY.taxId && `RUT ${LEGAL_ENTITY.taxId}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
