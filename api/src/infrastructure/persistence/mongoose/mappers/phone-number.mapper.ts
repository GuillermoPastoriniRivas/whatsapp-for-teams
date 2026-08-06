import { PhoneNumber } from '../../../../domain/entities/phone-number.entity.js';
import { MessagingProvider } from '../../../../domain/enums/messaging-provider.enum.js';
import { PhoneNumberStatus } from '../../../../domain/enums/phone-number-status.enum.js';
import { PhoneNumberDocument } from '../schemas/phone-number.schema.js';
import { decryptProviderConfig } from '../../../crypto/provider-config.cipher.js';

export class PhoneNumberMapper {
  static toDomain(doc: PhoneNumberDocument): PhoneNumber {
    return new PhoneNumber(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.provider as MessagingProvider,
      // El dominio siempre ve las credenciales en claro; el cifrado vive en la
      // capa de persistencia y los documentos sin migrar pasan tal cual.
      decryptProviderConfig(doc.providerConfig),
      doc.wabaId,
      doc.phoneNumberId,
      doc.displayPhone,
      doc.label,
      doc.webhookSecret,
      doc.status as PhoneNumberStatus,
      doc.createdAt,
      doc.portfolioId ?? null,
      doc.businessProfile ?? null,
    );
  }
}
