import type { BusinessVertical } from '../../../../domain/value-objects/business-profile.js';

export interface VerticalTemplate {
  businessKind: string;
  catalogLabel: string;
}

const TEMPLATES: Record<BusinessVertical, VerticalTemplate> = {
  beauty: {
    businessKind: 'a beauty / personal-care business (salon, barbershop, spa or similar)',
    catalogLabel: 'Services & Prices',
  },
  food: {
    businessKind: 'a food business (restaurant, delivery or takeaway)',
    catalogLabel: 'Menu & Prices',
  },
  retail: {
    businessKind: 'a retail store',
    catalogLabel: 'Products & Prices',
  },
  generic: {
    businessKind: 'a business',
    catalogLabel: 'Products / Services & Prices',
  },
};

export function getVerticalTemplate(vertical: BusinessVertical): VerticalTemplate {
  return TEMPLATES[vertical] ?? TEMPLATES.generic;
}
