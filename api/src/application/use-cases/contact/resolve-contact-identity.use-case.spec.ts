import { Contact } from '../../../domain/entities/contact.entity.js';
import { ResolveContactIdentityUseCase } from './resolve-contact-identity.use-case.js';

const PORTFOLIO = 'portfolio-1';
const TENANT = 'tenant-1';

function contact(overrides: Partial<Contact> & { id: string; createdAt: Date }): Contact {
  return new Contact(
    overrides.id,
    TENANT,
    overrides.name ?? 'Contacto',
    overrides.phone ?? null,
    null,
    overrides.createdAt,
    overrides.createdAt,
    null,
    null,
    null,
    {},
    overrides.bsuid ?? null,
    null,
    overrides.username ?? null,
    overrides.bsuid ? PORTFOLIO : null,
  );
}

function makeRepos(seed: Contact[]) {
  const store = new Map(seed.map((c) => [c.id, c]));
  const merges: Array<[string, string]> = [];

  const contactRepo = {
    findById: async (id: string) => store.get(id) ?? null,
    findByPhone: async (_t: string, phone: string) =>
      [...store.values()].find((c) => c.phone === phone) ?? null,
    findByBsuid: async (_t: string, portfolioId: string, bsuid: string) =>
      [...store.values()].find((c) => c.bsuid === bsuid && c.portfolioId === portfolioId) ?? null,
    create: async (_t: string, identity: any, profile: any) => {
      const created = contact({
        id: `new-${store.size + 1}`,
        createdAt: new Date(),
        phone: identity.phone,
        bsuid: identity.bsuid,
        username: identity.username,
        name: profile.name,
      });
      store.set(created.id, created);
      return created;
    },
    applyIdentity: async (id: string, identity: any) => {
      const current = store.get(id)!;
      const updated = contact({
        id,
        createdAt: current.createdAt,
        phone: identity.phone ?? current.phone,
        bsuid: identity.bsuid ?? current.bsuid,
        username: identity.username ?? current.username,
        name: current.name,
      });
      store.set(id, updated);
      return updated;
    },
  } as any;

  const mergeRepo = {
    merge: async (survivorId: string, duplicateId: string) => {
      merges.push([survivorId, duplicateId]);
      store.delete(duplicateId);
    },
  };

  return { contactRepo, mergeRepo, merges, store };
}

describe('ResolveContactIdentityUseCase', () => {
  it('crea el contacto cuando no existe ningún eje', async () => {
    const { contactRepo, mergeRepo } = makeRepos([]);
    const useCase = new ResolveContactIdentityUseCase(contactRepo, mergeRepo as any);

    const result = await useCase.execute({
      tenantId: TENANT,
      portfolioId: PORTFOLIO,
      bsuid: 'US.1349',
      username: 'guille',
    });

    expect(result.bsuid).toBe('US.1349');
    expect(result.phone).toBeNull();
  });

  it('escribe el BSUID sobre el contacto que ya existía por teléfono', async () => {
    const existing = contact({ id: 'c1', createdAt: new Date('2026-01-01'), phone: '5491155551001' });
    const { contactRepo, mergeRepo, merges } = makeRepos([existing]);
    const useCase = new ResolveContactIdentityUseCase(contactRepo, mergeRepo as any);

    const result = await useCase.execute({
      tenantId: TENANT,
      portfolioId: PORTFOLIO,
      phone: '5491155551001',
      bsuid: 'US.1349',
    });

    expect(result.id).toBe('c1');
    expect(result.bsuid).toBe('US.1349');
    expect(merges).toHaveLength(0);
  });

  it('fusiona cuando el teléfono revelado ya pertenecía a otro contacto', async () => {
    // El caso real: alguien conocido solo por BSUID comparte su número con
    // REQUEST_CONTACT_INFO, y ese número ya existía cargado por CSV.
    const fromCsv = contact({ id: 'csv', createdAt: new Date('2026-01-01'), phone: '5491155551001' });
    const fromChat = contact({ id: 'chat', createdAt: new Date('2026-05-01'), bsuid: 'US.1349' });
    const { contactRepo, mergeRepo, merges } = makeRepos([fromCsv, fromChat]);
    const useCase = new ResolveContactIdentityUseCase(contactRepo, mergeRepo as any);

    const result = await useCase.execute({
      tenantId: TENANT,
      portfolioId: PORTFOLIO,
      phone: '5491155551001',
      bsuid: 'US.1349',
    });

    // Sobrevive el más antiguo: acumuló más historia y la regla es determinista.
    expect(merges).toEqual([['csv', 'chat']]);
    expect(result.id).toBe('csv');
    expect(result.phone).toBe('5491155551001');
    expect(result.bsuid).toBe('US.1349');
  });

  it('es idempotente si el webhook se reentrega', async () => {
    const fromCsv = contact({ id: 'csv', createdAt: new Date('2026-01-01'), phone: '5491155551001' });
    const fromChat = contact({ id: 'chat', createdAt: new Date('2026-05-01'), bsuid: 'US.1349' });
    const { contactRepo, mergeRepo, merges } = makeRepos([fromCsv, fromChat]);
    const useCase = new ResolveContactIdentityUseCase(contactRepo, mergeRepo as any);

    const input = { tenantId: TENANT, portfolioId: PORTFOLIO, phone: '5491155551001', bsuid: 'US.1349' };
    await useCase.execute(input);
    const second = await useCase.execute(input);

    expect(merges).toHaveLength(1);
    expect(second.id).toBe('csv');
  });

  it('no confunde BSUIDs de portfolios distintos', async () => {
    const other = contact({ id: 'otro', createdAt: new Date('2026-01-01'), bsuid: 'US.1349' });
    const { contactRepo, mergeRepo } = makeRepos([other]);
    const useCase = new ResolveContactIdentityUseCase(contactRepo, mergeRepo as any);

    const result = await useCase.execute({
      tenantId: TENANT,
      portfolioId: 'portfolio-2',
      bsuid: 'US.1349',
    });

    expect(result.id).not.toBe('otro');
  });
});
