import { Contact } from '../../../../domain/entities/contact.entity.js';
import { ContactDocument } from '../schemas/contact.schema.js';

export class ContactMapper {
  static toDomain(doc: ContactDocument): Contact {
    return new Contact(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.name,
      doc.phone ?? null,
      doc.profilePicUrl,
      doc.lastSeenAt,
      doc.createdAt,
      doc.email ?? null,
      doc.company ?? null,
      doc.notes ?? null,
      doc.customFields ?? {},
      doc.bsuid ?? null,
      doc.parentBsuid ?? null,
      doc.username ?? null,
      doc.portfolioId ?? null,
      doc.marketingOptOutAt ?? null,
    );
  }
}
