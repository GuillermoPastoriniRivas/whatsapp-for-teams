import { RunEvaluationUseCase, parseJudgeVerdict } from './evaluation.use-cases.js';

describe('parseJudgeVerdict', () => {
  it('lee el veredicto aunque venga envuelto en texto', () => {
    const verdict = parseJudgeVerdict('Acá va: {"answered":true,"faithful":true,"matchedExpectation":null,"handedOff":false,"reason":"ok"} listo');
    expect(verdict).toMatchObject({ answered: true, faithful: true, matchedExpectation: null, handedOff: false });
  });

  it('la fidelidad sale de las afirmaciones, no de lo que el juez opine', () => {
    const verdict = parseJudgeVerdict(
      '{"claims":[{"text":"no tenemos estacionamiento","supported":false}],"answered":true,"faithful":true,"handedOff":false,"reason":"no lo contradice"}',
    );
    expect(verdict?.faithful).toBe(false);
    expect(verdict?.unsupportedClaims).toEqual(['no tenemos estacionamiento']);
  });

  it('sin afirmaciones sobre el negocio, es fiel', () => {
    const verdict = parseJudgeVerdict('{"claims":[],"answered":false,"handedOff":true,"reason":"derivó"}');
    expect(verdict?.faithful).toBe(true);
  });

  it('devuelve null si no hay JSON', () => {
    expect(parseJudgeVerdict('no pude evaluarlo')).toBeNull();
  });

  it('ante un campo ausente asume lo conservador: no contestó, pero tampoco lo acusa de inventar', () => {
    const verdict = parseJudgeVerdict('{"reason":"algo"}');
    expect(verdict).toMatchObject({ answered: false, faithful: true, handedOff: false });
  });
});

function buildUseCase(overrides: Record<string, any> = {}) {
  const deps = {
    evaluationRepo: {
      findCasesByTenantId: jest.fn(async () => []),
      createRun: jest.fn(async (run: any) => ({ ...run, id: 'run_1', createdAt: new Date() })),
      createCase: jest.fn(),
      findCaseById: jest.fn(),
      deleteCase: jest.fn(),
      findLastRun: jest.fn(),
    },
    tenantRepo: {
      findById: jest.fn(async () => ({
        id: 't1',
        businessProfile: { vertical: 'beauty', businessName: 'Tina', catalog: [], faqs: [] },
        timezone: null,
        businessHours: null,
        aiRateLimits: { maxMessagesPerDay: 0, maxTokensPerDay: 0 },
      })),
    },
    aiCompletion: { complete: jest.fn() },
    searchKnowledge: { execute: jest.fn(async () => []) },
    ...overrides,
  };
  return {
    deps,
    useCase: new RunEvaluationUseCase(
      deps.evaluationRepo as any,
      deps.tenantRepo as any,
      deps.aiCompletion as any,
      deps.searchKnowledge as any,
    ),
  };
}

const caso = (extra: Record<string, any> = {}) => ({
  id: 'c1',
  tenantId: 't1',
  question: '¿Cuánto sale la depilación?',
  expectation: '',
  expectHandoff: false,
  createdAt: new Date(),
  ...extra,
});

describe('RunEvaluationUseCase', () => {
  it('sin casos cargados no corre nada y lo dice', async () => {
    const { useCase, deps } = buildUseCase();
    const result = await useCase.execute('t1');

    expect(result.ok).toBe(false);
    expect(deps.aiCompletion.complete).not.toHaveBeenCalled();
  });

  it('marca como fallado lo que inventa, aunque haya contestado', async () => {
    const { useCase } = buildUseCase({
      evaluationRepo: {
        findCasesByTenantId: jest.fn(async () => [caso()]),
        createRun: jest.fn(async (run: any) => ({ ...run, id: 'run_1', createdAt: new Date() })),
      },
      aiCompletion: {
        complete: jest
          .fn()
          .mockResolvedValueOnce({ content: 'Sale 5.000 pesos.', tokensUsed: { total: 1 } })
          .mockResolvedValueOnce({
            content: '{"answered":true,"faithful":false,"matchedExpectation":null,"handedOff":false,"reason":"El precio no está en el material"}',
            tokensUsed: { total: 1 },
          }),
      },
    });

    const result = await useCase.execute('t1');

    expect(result.ok).toBe(true);
    const run = (result as any).value;
    expect(run.summary).toMatchObject({ total: 1, passed: 0, unfaithful: 1 });
    expect(run.verdicts[0].passed).toBe(false);
  });

  it('cuando el caso espera derivación, contestar bien no alcanza', async () => {
    const { useCase } = buildUseCase({
      evaluationRepo: {
        findCasesByTenantId: jest.fn(async () => [caso({ expectHandoff: true })]),
        createRun: jest.fn(async (run: any) => ({ ...run, id: 'run_1', createdAt: new Date() })),
      },
      aiCompletion: {
        complete: jest
          .fn()
          .mockResolvedValueOnce({ content: 'Sale 4.200 pesos.', tokensUsed: { total: 1 } })
          .mockResolvedValueOnce({
            content: '{"answered":true,"faithful":true,"matchedExpectation":null,"handedOff":false,"reason":"contestó sin derivar"}',
            tokensUsed: { total: 1 },
          }),
      },
    });

    const run = (await useCase.execute('t1')) as any;
    expect(run.value.verdicts[0].passed).toBe(false);
  });

  it('si el asistente se cae, el caso queda fallado y la corrida sigue', async () => {
    const { useCase } = buildUseCase({
      evaluationRepo: {
        findCasesByTenantId: jest.fn(async () => [caso(), caso({ id: 'c2' })]),
        createRun: jest.fn(async (run: any) => ({ ...run, id: 'run_1', createdAt: new Date() })),
      },
      aiCompletion: {
        complete: jest
          .fn()
          .mockRejectedValueOnce(new Error('sin cupo'))
          .mockResolvedValueOnce({ content: 'No tengo ese dato, lo consulto.', tokensUsed: { total: 1 } })
          .mockResolvedValueOnce({
            content: '{"answered":false,"faithful":true,"matchedExpectation":null,"handedOff":true,"reason":"derivó"}',
            tokensUsed: { total: 1 },
          }),
      },
    });

    const run = (await useCase.execute('t1')) as any;

    expect(run.value.summary.total).toBe(2);
    expect(run.value.verdicts[0].reason).toContain('sin cupo');
    expect(run.value.verdicts[1].passed).toBe(false);
  });

  it('cuenta como esquivada solo si tenía material para contestar', async () => {
    const { useCase } = buildUseCase({
      evaluationRepo: {
        findCasesByTenantId: jest.fn(async () => [caso()]),
        createRun: jest.fn(async (run: any) => ({ ...run, id: 'run_1', createdAt: new Date() })),
      },
      searchKnowledge: { execute: jest.fn(async () => [{ text: 'Piernas: 4.200', documentTitle: 'Precios', documentId: 'd1', score: 0.7 }]) },
      aiCompletion: {
        complete: jest
          .fn()
          .mockResolvedValueOnce({ content: 'Lo consulto con el equipo.', tokensUsed: { total: 1 } })
          .mockResolvedValueOnce({
            content: '{"answered":false,"faithful":true,"matchedExpectation":null,"handedOff":false,"reason":"esquivó"}',
            tokensUsed: { total: 1 },
          }),
      },
    });

    const run = (await useCase.execute('t1')) as any;
    expect(run.value.summary.dodged).toBe(1);
    expect(run.value.verdicts[0].excerptsUsed).toBe(1);
  });
});
