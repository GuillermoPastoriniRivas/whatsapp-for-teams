import { billingCategoryOf, hasCategoryMismatch, isBillable, type MessageCharge } from './message-charge.entity.js';
import { isWithinFreeEntryPoint } from '../value-objects/outbound-billing.js';

const charge = (overrides: Partial<MessageCharge> = {}): MessageCharge => ({
  id: '1',
  waMessageId: 'wamid.1',
  tenantId: 't',
  phoneNumberId: 'p',
  conversationId: 'c',
  messageId: 'm',
  contactId: 'ct',
  destinationCountry: 'AR',
  destinationPrefix: '54',
  sentAt: new Date('2026-10-05T10:00:00Z'),
  deliveredAt: new Date('2026-10-05T10:00:05Z'),
  failedAt: null,
  waErrorCode: null,
  senderKind: 'ai',
  campaignId: null,
  adSourceId: null,
  flowId: null,
  isTemplate: false,
  templateId: null,
  templateCategory: null,
  marketingLite: false,
  estimatedCategory: 'service',
  freeEntryPoint: false,
  windowOpen: true,
  meta: null,
  rate: null,
  source: 'live',
  ...overrides,
});

const pricing = (over: Partial<NonNullable<MessageCharge['meta']>> = {}) => ({
  billable: true,
  pricingModel: 'PMP',
  pricingType: 'regular',
  category: 'service',
  conversationId: null,
  conversationOrigin: null,
  conversationExpiresAt: null,
  raw: null,
  receivedAt: new Date('2026-10-05T10:00:05Z'),
  ...over,
});

describe('billingCategoryOf', () => {
  it('usa nuestra estimación mientras Meta no dijo nada', () => {
    expect(billingCategoryOf(charge({ estimatedCategory: 'utility' }))).toBe('utility');
  });

  it('le da prioridad a Meta, que es quien emite la factura', () => {
    const c = charge({ estimatedCategory: 'utility', meta: pricing({ category: 'marketing' }) });
    expect(billingCategoryOf(c)).toBe('marketing');
  });
});

describe('isBillable', () => {
  it('respeta el billable=false de Meta aunque hayamos estimado que se cobra', () => {
    expect(isBillable(charge({ meta: pricing({ billable: false }) }))).toBe(false);
  });

  it('respeta el billable=true de Meta aunque estuviera en el free entry point', () => {
    // Pasa de verdad con Meta Business Agent: los tokens se cobran igual dentro
    // de la ventana gratis. Nuestra estimación no puede ganarle a la factura.
    expect(isBillable(charge({ freeEntryPoint: true, meta: pricing({ billable: true }) }))).toBe(true);
  });

  it('no cobra un mensaje fallido', () => {
    expect(isBillable(charge({ deliveredAt: null, failedAt: new Date() }))).toBe(false);
  });

  it('sin datos de Meta, estima gratis dentro del free entry point', () => {
    expect(isBillable(charge({ freeEntryPoint: true }))).toBe(false);
    expect(isBillable(charge({ freeEntryPoint: false }))).toBe(true);
  });
});

describe('hasCategoryMismatch', () => {
  it('marca cuando Meta cobró algo distinto a lo que estimamos', () => {
    expect(hasCategoryMismatch(charge({ estimatedCategory: 'service', meta: pricing({ category: 'utility' }) }))).toBe(true);
    expect(hasCategoryMismatch(charge({ estimatedCategory: 'service', meta: pricing({ category: 'service' }) }))).toBe(false);
  });

  it('no marca nada mientras Meta no haya dicho su categoría', () => {
    expect(hasCategoryMismatch(charge({ meta: null }))).toBe(false);
  });
});

describe('isWithinFreeEntryPoint', () => {
  const click = new Date('2026-10-01T00:00:00Z');

  it('cubre 72 horas desde el click en el anuncio', () => {
    expect(isWithinFreeEntryPoint(click, new Date('2026-10-03T23:59:00Z'))).toBe(true);
    expect(isWithinFreeEntryPoint(click, new Date('2026-10-04T00:01:00Z'))).toBe(false);
  });

  it('sin click no hay ventana gratis', () => {
    expect(isWithinFreeEntryPoint(null, new Date())).toBe(false);
  });

  it('ignora un click posterior al envío (reloj corrido)', () => {
    expect(isWithinFreeEntryPoint(click, new Date('2026-09-30T00:00:00Z'))).toBe(false);
  });
});
