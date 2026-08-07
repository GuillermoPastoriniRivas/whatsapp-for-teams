import { Injectable } from '@nestjs/common';
import type {
  BusinessProfileContext,
  BusinessProfileUpdate,
} from '../../application/ports/business-profile.port.js';
import type { WhatsAppBusinessProfile } from '../../domain/entities/whatsapp-business-profile.entity.js';

/**
 * Proveedor demo: no hay ninguna API atrás, así que el perfil que se guarda en
 * el propio número es la única fuente. Por eso la lectura devuelve `null` (=
 * "no tengo copia propia, usá la tuya") y la escritura no hace nada: el caso de
 * uso ya persiste lo que mandó el usuario.
 *
 * La foto queda fuera: subirla necesitaría guardarla en algún lado real, y una
 * foto que no se puede servir es peor que no ofrecer el botón. Se bloquea antes
 * por `provider-capabilities` (`profilePicture: false`).
 */
@Injectable()
export class DemoBusinessProfileApiService {
  async getProfile(_ctx: BusinessProfileContext): Promise<WhatsAppBusinessProfile | null> {
    return null;
  }

  async updateProfile(_ctx: BusinessProfileContext, _update: BusinessProfileUpdate): Promise<void> {
    return;
  }

  async uploadProfilePicture(): Promise<string> {
    throw new Error('El proveedor demo no permite cambiar la foto de perfil.');
  }
}
