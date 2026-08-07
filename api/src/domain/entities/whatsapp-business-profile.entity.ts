/**
 * Perfil de negocio de un número de WhatsApp: lo que ve el cliente cuando
 * toca el nombre del contacto en su teléfono.
 *
 * El dueño del dato es Meta, no nosotros. Guardamos una copia en el número
 * (ver `PhoneNumber.businessProfile`) para pintar la pantalla sin depender de
 * que la API responda, pero cada lectura la refresca y cada escritura va
 * primero al proveedor: si el proveedor rechaza, la copia no se toca.
 */
export interface WhatsAppBusinessProfile {
  /** Frase corta bajo el nombre, máx. 139 caracteres. */
  about: string | null;
  /** Dirección física, máx. 256. */
  address: string | null;
  /** Descripción del negocio, máx. 512. */
  description: string | null;
  /** Mail de contacto, máx. 128. */
  email: string | null;
  /** Rubro. Ver `BusinessVertical`. */
  vertical: string | null;
  /** Hasta dos sitios, con esquema http(s). */
  websites: string[];
  /**
   * URL de la foto tal como la sirve el proveedor. Es de solo lectura: para
   * cambiarla hay que subir la imagen y mandar el handle que devuelve.
   */
  profilePictureUrl: string | null;
}

export const EMPTY_BUSINESS_PROFILE: WhatsAppBusinessProfile = {
  about: null,
  address: null,
  description: null,
  email: null,
  vertical: null,
  websites: [],
  profilePictureUrl: null,
};

/** Topes de Meta. Se validan acá para no gastar un viaje a la API. */
export const BUSINESS_PROFILE_LIMITS = {
  about: 139,
  address: 256,
  description: 512,
  email: 128,
  websites: 2,
  websiteUrl: 256,
} as const;
