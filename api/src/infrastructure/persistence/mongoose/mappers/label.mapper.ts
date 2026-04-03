import { Label } from '../../../../domain/entities/label.entity.js';
import { LabelDocument } from '../schemas/label.schema.js';

export class LabelMapper {
  static toDomain(doc: LabelDocument): Label {
    return new Label(
      doc._id.toHexString(),
      doc.tenantId.toHexString(),
      doc.name,
      doc.color,
      doc.createdAt,
    );
  }
}
