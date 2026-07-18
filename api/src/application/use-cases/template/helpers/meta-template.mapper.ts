import { TemplateCategory } from '../../../../domain/enums/template-category.enum.js';
import { TemplateQuality } from '../../../../domain/enums/template-quality.enum.js';
import { TemplateStatus } from '../../../../domain/enums/template-status.enum.js';

/** Maps Meta's uppercase template status strings to the domain enum. */
export function mapMetaTemplateStatus(status: string | null | undefined): TemplateStatus {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED':
      return TemplateStatus.APPROVED;
    case 'REJECTED':
      return TemplateStatus.REJECTED;
    case 'PAUSED':
      return TemplateStatus.PAUSED;
    case 'DISABLED':
      return TemplateStatus.DISABLED;
    case 'PENDING':
    case 'IN_APPEAL':
    case 'PENDING_DELETION':
    case 'FLAGGED':
    case 'LIMIT_EXCEEDED':
    default:
      return TemplateStatus.PENDING;
  }
}

/** Maps Meta quality scores (GREEN/YELLOW/RED/UNKNOWN) to the domain enum. */
export function mapMetaTemplateQuality(score: string | null | undefined): TemplateQuality {
  switch ((score ?? '').toUpperCase()) {
    case 'GREEN':
      return TemplateQuality.GREEN;
    case 'YELLOW':
      return TemplateQuality.YELLOW;
    case 'RED':
      return TemplateQuality.RED;
    default:
      return TemplateQuality.UNKNOWN;
  }
}

/** Maps Meta category strings to the domain enum (null when unrecognized). */
export function mapMetaTemplateCategory(category: string | null | undefined): TemplateCategory | null {
  switch ((category ?? '').toUpperCase()) {
    case 'MARKETING':
      return TemplateCategory.MARKETING;
    case 'UTILITY':
      return TemplateCategory.UTILITY;
    case 'AUTHENTICATION':
      return TemplateCategory.AUTHENTICATION;
    default:
      return null;
  }
}
