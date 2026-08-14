export class EvaluationCase {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly question: string,
    /** Qué tiene que contener una buena respuesta. Vacío = solo se juzga que no invente. */
    public readonly expectation: string,
    /** Si esta pregunta la tiene que resolver una persona y no el asistente. */
    public readonly expectHandoff: boolean,
    public readonly createdAt: Date,
  ) {}
}

export interface EvaluationVerdict {
  caseId: string;
  question: string;
  answer: string;
  /** Contestó de verdad, en vez de esquivar la pregunta. */
  answered: boolean;
  /** Todo lo que afirmó está respaldado por el conocimiento o los datos del negocio. */
  faithful: boolean;
  /** Cumplió lo que se esperaba. Null cuando el caso no declara expectativa. */
  matchedExpectation: boolean | null;
  /** Derivó a una persona. */
  handedOff: boolean;
  passed: boolean;
  reason: string;
  excerptsUsed: number;
}

export interface EvaluationRunSummary {
  total: number;
  passed: number;
  /** Lo más grave: afirmó algo que nadie le dijo. */
  unfaithful: number;
  /** Tenía la respuesta a mano y aun así esquivó. */
  dodged: number;
}

export class EvaluationRun {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly summary: EvaluationRunSummary,
    public readonly verdicts: EvaluationVerdict[],
    public readonly createdAt: Date,
  ) {}
}
