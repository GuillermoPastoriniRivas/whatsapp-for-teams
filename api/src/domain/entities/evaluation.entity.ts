export class EvaluationCase {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly question: string,
    public readonly expectation: string,
    public readonly expectHandoff: boolean,
    public readonly createdAt: Date,
  ) {}
}

export interface EvaluationVerdict {
  caseId: string;
  question: string;
  answer: string;
  answered: boolean;
  faithful: boolean;
  matchedExpectation: boolean | null;
  handedOff: boolean;
  passed: boolean;
  reason: string;
  excerptsUsed: number;
}

export interface EvaluationRunSummary {
  total: number;
  passed: number;
  unfaithful: number;
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
