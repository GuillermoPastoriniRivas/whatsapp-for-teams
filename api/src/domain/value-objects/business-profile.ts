// ── El negocio, una sola vez ─────────────────────────────────────
// Nombre, rubro, dirección, catálogo, horarios: esto describe al negocio, no
// al bot que atiende. Vivía adentro de la config de cada agente IA, así que
// tener dos bots obligaba a mantener dos copias del mismo dato y una siempre
// quedaba vieja. Desde ago-2026 vive en la cuenta y los nodos de IA lo leen.
//
// Ojo: no confundir con WhatsAppBusinessProfile — ese es el perfil que ve el
// cliente al tocar el nombre del chat en su teléfono, y lo sirve Meta.

export type BusinessVertical = 'beauty' | 'food' | 'retail' | 'generic';

export interface CatalogItem {
  name: string;
  price: string; // texto libre: "$8.000", "desde $5.000"
  description: string;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface BusinessHoursRange {
  open: string; // 'HH:mm' 24h
  close: string; // 'HH:mm' 24h; menor que open = cierra pasada la medianoche
}

export type BusinessHours = Partial<Record<WeekDay, BusinessHoursRange | null>>;

export interface BusinessProfile {
  vertical: BusinessVertical;
  businessName: string;
  description: string;
  address: string;
  paymentMethods: string;
  catalog: CatalogItem[];
  faqs: FaqEntry[];
  extraNotes: string;
  assistantInstructions: string;
}

export const EMPTY_BUSINESS_PROFILE: BusinessProfile = {
  vertical: 'generic',
  businessName: '',
  description: '',
  address: '',
  paymentMethods: '',
  catalog: [],
  faqs: [],
  extraNotes: '',
  assistantInstructions: '',
};
