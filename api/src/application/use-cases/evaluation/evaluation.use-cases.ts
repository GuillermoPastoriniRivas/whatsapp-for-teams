import { Logger } from '@nestjs/common';
import type { EvaluationRepository } from '../../../domain/repositories/evaluation.repository.js';
import type { TenantRepository } from '../../../domain/repositories/tenant.repository.js';
import {
  EvaluationCase,
  EvaluationRun,
  type EvaluationVerdict,
} from '../../../domain/entities/evaluation.entity.js';
import type { AiCompletionPort } from '../../ports/ai-completion.port.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';
import { resolveAiPersona } from '../../../domain/value-objects/ai-persona.js';
import { buildAgentSystemPrompt } from '../ai/ai-run.helpers.js';
import type { SearchKnowledgeUseCase } from '../knowledge/knowledge.use-cases.js';

export const MAX_CASES_PER_TENANT = 100;
export const JUDGE_MAX_TOKENS = 400;

const EVALUATION_PERSONA = {
  name: 'Asistente',
  behavior: {},
  handoffRules: {},
  contextConfig: { includeContactInfo: false },
  multiMessage: { enabled: false },
};

const JUDGE_PROMPT = `Sos un evaluador estricto de asistentes de atención al cliente por WhatsApp.

Te doy: la pregunta de un cliente, la respuesta que dio el asistente, y EXACTAMENTE el material que el asistente tenía disponible. Tu trabajo es juzgar la respuesta contra ese material, no contra tu conocimiento del mundo.

Devolvé SOLO un objeto JSON con estas claves:
{"claims": [{"text": string, "supported": boolean}], "answered": boolean, "matchedExpectation": boolean|null, "handedOff": boolean, "reason": string}

- claims: TODA afirmación sobre el negocio que hace la respuesta, una por elemento, con el texto tal cual la dijo.
  Para cada una, supported es true SOLO si podés señalarla con el dedo en el material. La regla es **respaldado**, no "no contradicho": si el material no habla del tema, supported es false — aunque suene razonable, aunque sea probablemente cierta, aunque no contradiga nada.
  Las negaciones son afirmaciones: "no tenemos estacionamiento", "no abrimos los domingos", "no aceptamos esa tarjeta". Que el material no las mencione NO las respalda; son supported false.
  NO son claims: saludar, ofrecer ayuda, hacer una pregunta, decir "no tengo esa información" o "lo consulto con el equipo". Si la respuesta no afirma nada del negocio, claims va vacío.
- answered: true si resolvió la consulta. false si esquivó, pidió datos que ya tenía, o solo dijo que iba a consultar.
- matchedExpectation: si te doy una expectativa, true solo si la respuesta la cumple. Si no te doy expectativa, null.
- handedOff: true si pasó o dijo que iba a pasar la conversación a una persona del equipo.
- reason: una oración, en castellano, explicando lo que más pesó.

Sin markdown, sin explicaciones fuera del JSON.`;

export class CreateEvaluationCaseUseCase {
  constructor(private readonly evaluationRepo: EvaluationRepository) {}

  async execute(input: {
    tenantId: string;
    question: string;
    expectation?: string;
    expectHandoff?: boolean;
  }): Promise<Result<EvaluationCase, DomainError>> {
    const question = input.question.trim();
    if (!question) return err(new DomainError('EVALUATION_QUESTION_REQUIRED', 'El caso necesita una pregunta.'));

    const existing = await this.evaluationRepo.findCasesByTenantId(input.tenantId);
    if (existing.length >= MAX_CASES_PER_TENANT) {
      return err(
        new DomainError(
          'EVALUATION_LIMIT_REACHED',
          `Llegaste al tope de ${MAX_CASES_PER_TENANT} casos. Borrá alguno antes de agregar otro.`,
        ),
      );
    }

    return ok(
      await this.evaluationRepo.createCase({
        tenantId: input.tenantId,
        question,
        expectation: input.expectation?.trim() ?? '',
        expectHandoff: input.expectHandoff ?? false,
      }),
    );
  }
}

export class ListEvaluationCasesUseCase {
  constructor(private readonly evaluationRepo: EvaluationRepository) {}

  execute(tenantId: string): Promise<EvaluationCase[]> {
    return this.evaluationRepo.findCasesByTenantId(tenantId);
  }
}

export class DeleteEvaluationCaseUseCase {
  constructor(private readonly evaluationRepo: EvaluationRepository) {}

  async execute(tenantId: string, caseId: string): Promise<Result<true, DomainError>> {
    const found = await this.evaluationRepo.findCaseById(caseId);
    if (!found || found.tenantId !== tenantId) {
      return err(new DomainError('EVALUATION_CASE_NOT_FOUND', 'Ese caso no existe.'));
    }
    await this.evaluationRepo.deleteCase(caseId);
    return ok(true);
  }
}

export class GetLastEvaluationRunUseCase {
  constructor(private readonly evaluationRepo: EvaluationRepository) {}

  execute(tenantId: string): Promise<EvaluationRun | null> {
    return this.evaluationRepo.findLastRun(tenantId);
  }
}

export class RunEvaluationUseCase {
  private readonly logger = new Logger(RunEvaluationUseCase.name);

  constructor(
    private readonly evaluationRepo: EvaluationRepository,
    private readonly tenantRepo: TenantRepository,
    private readonly aiCompletion: AiCompletionPort,
    private readonly searchKnowledge: SearchKnowledgeUseCase,
  ) {}

  async execute(tenantId: string): Promise<Result<EvaluationRun, DomainError>> {
    const cases = await this.evaluationRepo.findCasesByTenantId(tenantId);
    if (cases.length === 0) {
      return err(
        new DomainError('EVALUATION_NO_CASES', 'Todavía no cargaste ninguna pregunta para probar el asistente.'),
      );
    }

    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) return err(new DomainError('TENANT_NOT_FOUND', 'No se pudo leer la cuenta.'));

    const persona = resolveAiPersona(tenant, EVALUATION_PERSONA);
    const verdicts: EvaluationVerdict[] = [];

    for (const testCase of cases) {
      verdicts.push(await this.judgeCase(tenantId, persona, testCase));
    }

    const summary = {
      total: verdicts.length,
      passed: verdicts.filter((v) => v.passed).length,
      unfaithful: verdicts.filter((v) => !v.faithful).length,
      dodged: verdicts.filter((v) => !v.answered && !v.handedOff && v.excerptsUsed > 0).length,
    };

    return ok(await this.evaluationRepo.createRun({ tenantId, summary, verdicts }));
  }

  private async judgeCase(
    tenantId: string,
    persona: ReturnType<typeof resolveAiPersona>,
    testCase: EvaluationCase,
  ): Promise<EvaluationVerdict> {
    const base: EvaluationVerdict = {
      caseId: testCase.id,
      question: testCase.question,
      answer: '',
      answered: false,
      faithful: true,
      matchedExpectation: testCase.expectation ? false : null,
      handedOff: false,
      passed: false,
      reason: '',
      excerptsUsed: 0,
    };

    let excerpts: Array<{ text: string; documentTitle: string }> = [];
    try {
      excerpts = (await this.searchKnowledge.execute(tenantId, testCase.question)).map((e) => ({
        text: e.text,
        documentTitle: e.documentTitle,
      }));
    } catch (error: any) {
      this.logger.warn(`No se pudo recuperar conocimiento para "${testCase.question}": ${error?.message}`);
    }

    const systemPrompt = buildAgentSystemPrompt({
      config: persona,
      contact: null,
      conversationSummary: null,
      labels: [],
      knowledge: excerpts.length ? excerpts : undefined,
    });

    let answer: string;
    try {
      const result = await this.aiCompletion.complete({
        systemPrompt,
        messages: [{ role: 'user', content: testCase.question }],
      });
      answer = (result.content ?? '').trim();
    } catch (error: any) {
      return { ...base, excerptsUsed: excerpts.length, reason: `El asistente no pudo responder: ${error?.message}` };
    }

    if (!answer) {
      return { ...base, excerptsUsed: excerpts.length, reason: 'El asistente no produjo respuesta.' };
    }

    const material = [
      systemPrompt.includes('## Knowledge Base')
        ? excerpts.map((e, i) => `[${i + 1}] ${e.documentTitle}\n${e.text}`).join('\n\n')
        : '(sin fragmentos de conocimiento relevantes)',
    ].join('\n');

    const judgeInput = [
      `PREGUNTA DEL CLIENTE:\n${testCase.question}`,
      `RESPUESTA DEL ASISTENTE:\n${answer}`,
      `MATERIAL DISPONIBLE:\n${material}`,
      testCase.expectation ? `EXPECTATIVA:\n${testCase.expectation}` : 'EXPECTATIVA:\n(ninguna)',
    ].join('\n\n');

    try {
      const judged = await this.aiCompletion.complete({
        systemPrompt: JUDGE_PROMPT,
        messages: [{ role: 'user', content: judgeInput }],
        maxTokens: JUDGE_MAX_TOKENS,
      });
      const parsed = parseJudgeVerdict(judged.content ?? '');
      if (!parsed) {
        return { ...base, answer, excerptsUsed: excerpts.length, reason: 'El evaluador no devolvió un JSON válido.' };
      }

      const matchedExpectation = testCase.expectation ? parsed.matchedExpectation === true : null;
      const passed =
        parsed.faithful &&
        (testCase.expectHandoff ? parsed.handedOff : parsed.answered) &&
        (matchedExpectation ?? true);

      return {
        caseId: testCase.id,
        question: testCase.question,
        answer,
        answered: parsed.answered,
        faithful: parsed.faithful,
        matchedExpectation,
        handedOff: parsed.handedOff,
        passed,
        reason: parsed.unsupportedClaims.length
          ? `Afirmó sin respaldo: ${parsed.unsupportedClaims.join(' · ')}`
          : parsed.reason,
        excerptsUsed: excerpts.length,
      };
    } catch (error: any) {
      return { ...base, answer, excerptsUsed: excerpts.length, reason: `El evaluador falló: ${error?.message}` };
    }
  }
}

interface JudgeVerdict {
  answered: boolean;
  faithful: boolean;
  unsupportedClaims: string[];
  matchedExpectation: boolean | null;
  handedOff: boolean;
  reason: string;
}

export function parseJudgeVerdict(raw: string): JudgeVerdict | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;

    const claims = Array.isArray(parsed.claims) ? (parsed.claims as Array<Record<string, unknown>>) : null;
    const unsupportedClaims = (claims ?? [])
      .filter((claim) => claim?.supported === false)
      .map((claim) => String(claim.text ?? '').trim())
      .filter(Boolean);

    return {
      answered: parsed.answered === true,
      faithful: claims ? unsupportedClaims.length === 0 : parsed.faithful !== false,
      unsupportedClaims,
      matchedExpectation:
        parsed.matchedExpectation === null || parsed.matchedExpectation === undefined
          ? null
          : parsed.matchedExpectation === true,
      handedOff: parsed.handedOff === true,
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    };
  } catch {
    return null;
  }
}
