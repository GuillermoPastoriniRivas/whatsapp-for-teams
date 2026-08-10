import {
  CreateServiceProviderUseCase,
  UpdateServiceProviderUseCase,
  normalizeService,
} from './service-provider.use-cases.js';

// Un proveedor recibe mensajes que le escribimos PRIMERO, sin que nos haya
// hablado. Si eso pasa sin su permiso, Meta baja la calidad del número — y el
// número es del cliente. Por eso el opt-in es una invariante del dominio y no
// un checkbox de la UI: estas pruebas son las que lo sostienen.

function makeRepo(existing: any = null) {
  const saved: any[] = [];
  return {
    saved,
    repo: {
      findById: async () => existing,
      create: async (input: any) => {
        saved.push(input);
        return { id: 'p1', ...input };
      },
      update: async (_id: string, patch: any) => {
        saved.push(patch);
        return { ...existing, ...patch };
      },
    } as any,
  };
}

describe('opt-in de proveedores', () => {
  it('no deja activar uno sin permiso registrado', async () => {
    const { repo, saved } = makeRepo();
    const result = await new CreateServiceProviderUseCase(repo).execute({
      tenantId: 't1',
      name: 'Juan',
      phone: '+59899123456',
      services: ['carpinteria'],
      active: true,
      optIn: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PROVIDER_OPT_IN_REQUIRED');
    expect(saved).toHaveLength(0);
  });

  it('deja crearlo pausado sin permiso', async () => {
    // Cargar el dato antes de conseguir el permiso es legítimo; lo que no se
    // puede es que reciba derivaciones.
    const { repo } = makeRepo();
    const result = await new CreateServiceProviderUseCase(repo).execute({
      tenantId: 't1',
      name: 'Juan',
      phone: '+59899123456',
      services: ['carpinteria'],
      active: false,
      optIn: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.optInAt).toBeNull();
  });

  it('estampa la fecha del permiso al activarlo', async () => {
    const { repo, saved } = makeRepo();
    const result = await new CreateServiceProviderUseCase(repo).execute({
      tenantId: 't1',
      name: 'Juan',
      phone: '+59899123456',
      services: ['carpinteria'],
      active: true,
      optIn: true,
    });

    expect(result.ok).toBe(true);
    expect(saved[0].optInAt).toBeInstanceOf(Date);
  });

  it('no deja revocar el permiso dejándolo activo', async () => {
    const existing = { id: 'p1', tenantId: 't1', active: true, optInAt: new Date() };
    const { repo } = makeRepo(existing);
    const result = await new UpdateServiceProviderUseCase(repo).execute('t1', 'p1', { optIn: false });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PROVIDER_OPT_IN_REQUIRED');
  });

  it('conserva la fecha original del permiso al editar', async () => {
    // Sirve como registro de cuándo aceptó: pisarla borraría la prueba.
    const original = new Date('2026-01-15T10:00:00Z');
    const existing = { id: 'p1', tenantId: 't1', active: true, optInAt: original };
    const { repo, saved } = makeRepo(existing);

    const result = await new UpdateServiceProviderUseCase(repo).execute('t1', 'p1', {
      optIn: true,
      name: 'Juan Pérez',
    });

    expect(result.ok).toBe(true);
    expect(saved[0].optInAt).toBe(original);
  });

  it('rechaza un teléfono que no se puede normalizar', async () => {
    const { repo } = makeRepo();
    const result = await new CreateServiceProviderUseCase(repo).execute({
      tenantId: 't1',
      name: 'Juan',
      phone: 'no soy un teléfono',
      services: [],
      active: false,
      optIn: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PROVIDER_BAD_PHONE');
  });
});

describe('normalización de servicios', () => {
  it('empareja lo que escribe el admin con lo que manda el flujo', () => {
    // El admin escribe "Carpintería" y la fila de la lista manda "carpinteria":
    // sin normalizar, el reparto no encuentra a nadie y el lead se pierde.
    expect(normalizeService('  Carpintería  ')).toBe('carpinteria');
    expect(normalizeService('Aire   Acondicionado')).toBe('aire acondicionado');
    expect(normalizeService('PLOMERÍA')).toBe('plomeria');
  });

  it('deduplica y limpia al guardar', async () => {
    const { repo, saved } = makeRepo();
    await new CreateServiceProviderUseCase(repo).execute({
      tenantId: 't1',
      name: 'Juan',
      phone: '+59899123456',
      services: ['Carpintería', 'carpinteria', '  ', 'Muebles'],
      active: false,
      optIn: false,
    });

    expect(saved[0].services).toEqual(['carpinteria', 'muebles']);
  });
});
