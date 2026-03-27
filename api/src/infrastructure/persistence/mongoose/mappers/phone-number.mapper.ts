import { PhoneNumber } from '../../../../domain/entities/phone-number.entity.js';
import { MessagingProvider } from '../../../../domain/enums/messaging-provider.enum.js';
import { PhoneNumberStatus } from '../../../../domain/enums/phone-number-status.enum.js';
import { PhoneNumberDocument } from '../schemas/phone-number.schema.js';

export class PhoneNumberMapper {
  static toDomain(doc: PhoneNumberDocument): PhoneNumber {
    return new PhoneNumber(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.provider as MessagingProvider,
      doc.providerConfig,
      doc.wabaId,
      doc.phoneNumberId,
      doc.displayPhone,
      doc.label,
      doc.webhookSecret,
      doc.status as PhoneNumberStatus,
      doc.createdAt,
    );
  }
}
