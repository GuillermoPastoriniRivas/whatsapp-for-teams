import { Contact } from '../../../../domain/entities/contact.entity.js';
import { ContactDocument } from '../schemas/contact.schema.js';

export class ContactMapper {
  static toDomain(doc: ContactDocument): Contact {
    return new Contact(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.waId,
      doc.name,
      doc.phone,
      doc.profilePicUrl,
      doc.lastSeenAt,
      doc.createdAt,
      doc.email ?? null,
      doc.company ?? null,
      doc.notes ?? null,
      doc.customFields ?? {},
    );
  }
}
