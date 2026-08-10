import { FlowEngineService } from './flow-engine.service.js';

// Decidir si al proveedor se le puede mandar texto libre en vez de plantilla.
//
// Equivocarse para el lado permisivo hace que Meta rechace el envío y el dato no
// llegue; equivocarse para el lado conservador solo cuesta una plantilla. Por eso
// todos los caminos dudosos devuelven false.

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Solo se ejercita providerWindowIsOpen: el resto de las dependencias no se toca. */
function buildEngine(deps: { contactRepo: any; conversationRepo: any }): any {
  const engine = Object.create(FlowEngineService.prototype);
  Object.assign(engine, {
    contactRepo: deps.contactRepo,
    conversationRepo: deps.conversationRepo,
    logger: { warn: () => {} },
  });
  return engine;
}

const ctx = { tenantId: 't1', phone: { id: 'linea-1' } } as any;

const contactFound = { findByPhone: async () => ({ id: 'c1' }) };

describe('ventana de 24 h con el proveedor', () => {
  it('abierta si escribió recién', async () => {
    const engine = buildEngine({
      contactRepo: contactFound,
      conversationRepo: { findByContactAndPhone: async () => ({ lastInboundAt: new Date() }) },
    });
    expect(await engine.providerWindowIsOpen(ctx, '59899123456')).toBe(true);
  });

  it('cerrada si escribió hace más de 24 h', async () => {
    const engine = buildEngine({
      contactRepo: contactFound,
      conversationRepo: {
        findByContactAndPhone: async () => ({ lastInboundAt: new Date(Date.now() - WINDOW_MS - 1000) }),
      },
    });
    expect(await engine.providerWindowIsOpen(ctx, '59899123456')).toBe(false);
  });

  it('cerrada si el proveedor nunca escribió', async () => {
    // No tiene contacto porque no se le crea uno al mandarle el dato: solo
    // existe si alguna vez escribió él.
    const engine = buildEngine({
      contactRepo: { findByPhone: async () => null },
      conversationRepo: { findByContactAndPhone: async () => null },
    });
    expect(await engine.providerWindowIsOpen(ctx, '59899123456')).toBe(false);
  });

  it('cerrada si escribió a otra línea', async () => {
    // La ventana es por (contacto, línea). Escribirle desde la línea B porque
    // habló con la A lo rechaza Meta.
    const engine = buildEngine({
      contactRepo: contactFound,
      conversationRepo: {
        findByContactAndPhone: async (_c: string, phoneId: string) =>
          phoneId === 'linea-2' ? { lastInboundAt: new Date() } : null,
      },
    });
    expect(await engine.providerWindowIsOpen(ctx, '59899123456')).toBe(false);
  });

  it('cerrada si la consulta falla', async () => {
    // Ante la duda, plantilla: cuesta plata pero llega.
    const engine = buildEngine({
      contactRepo: {
        findByPhone: async () => {
          throw new Error('mongo caído');
        },
      },
      conversationRepo: { findByContactAndPhone: async () => null },
    });
    expect(await engine.providerWindowIsOpen(ctx, '59899123456')).toBe(false);
  });
});
