import { classifyMetaError, MetaApiError } from './meta-api-error.js';

function body(code: number, message = 'Some error') {
  return { error: { code, message } };
}

describe('classifyMetaError', () => {
  it('classifies rate limit codes as retryable rate_limit', () => {
    for (const code of [4, 80007, 130429, 131048, 131056]) {
      const error = classifyMetaError(400, body(code));
      expect(error).toBeInstanceOf(MetaApiError);
      expect(error.severity).toBe('rate_limit');
      expect(error.retryable).toBe(true);
    }
  });

  it('classifies recipient-level codes as terminal recipient errors', () => {
    for (const code of [131026, 131047, 131049, 130472, 132000]) {
      const error = classifyMetaError(400, body(code));
      expect(error.severity).toBe('recipient');
      expect(error.retryable).toBe(false);
    }
  });

  it('classifies token/template codes as campaign-level errors', () => {
    for (const code of [190, 132001, 132015, 133010]) {
      const error = classifyMetaError(401, body(code));
      expect(error.severity).toBe('campaign');
      expect(error.retryable).toBe(false);
    }
  });

  it('treats unknown 4xx application errors as recipient-level', () => {
    const error = classifyMetaError(400, body(999999));
    expect(error.severity).toBe('recipient');
  });

  it('treats 5xx and unparseable bodies as retryable', () => {
    expect(classifyMetaError(500, body(1)).retryable).toBe(true);
    expect(classifyMetaError(502, null).retryable).toBe(true);
  });

  it('keeps code, subcode and message details', () => {
    const error = classifyMetaError(400, {
      error: { code: 132000, error_subcode: 2494010, message: 'Param mismatch' },
    });
    expect(error.code).toBe(132000);
    expect(error.subcode).toBe(2494010);
    expect(error.title).toBe('Param mismatch');
  });
});
