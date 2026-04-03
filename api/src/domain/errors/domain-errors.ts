export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ConversationWindowExpiredError extends DomainError {
  constructor() {
    super(
      'CONVERSATION_WINDOW_EXPIRED',
      'The 24-hour messaging window has expired. Use an approved Message Template to re-engage this contact.',
    );
  }
}

export class AgentNotAssignedError extends DomainError {
  constructor() {
    super('AGENT_NOT_ASSIGNED', 'You are not assigned to this conversation.');
  }
}

export class ConversationNotFoundError extends DomainError {
  constructor() {
    super('CONVERSATION_NOT_FOUND', 'Conversation not found.');
  }
}

export class AgentNotFoundError extends DomainError {
  constructor() {
    super('AGENT_NOT_FOUND', 'Agent not found.');
  }
}

export class PhoneNumberNotFoundError extends DomainError {
  constructor() {
    super('PHONE_NUMBER_NOT_FOUND', 'Phone number not found.');
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('INVALID_CREDENTIALS', 'Invalid email or password.');
  }
}

export class EmailAlreadyExistsError extends DomainError {
  constructor() {
    super('EMAIL_ALREADY_EXISTS', 'An agent with this email already exists.');
  }
}

export class PhoneAccessAlreadyExistsError extends DomainError {
  constructor() {
    super('PHONE_ACCESS_ALREADY_EXISTS', 'This agent already has access to this phone number.');
  }
}

export class CrossTenantAccessError extends DomainError {
  constructor() {
    super('CROSS_TENANT_ACCESS', 'Cannot access resources from a different tenant.');
  }
}

export class LabelNotFoundError extends DomainError {
  constructor() {
    super('LABEL_NOT_FOUND', 'Label not found.');
  }
}

export class LabelAlreadyAssignedError extends DomainError {
  constructor() {
    super('LABEL_ALREADY_ASSIGNED', 'This label is already assigned to the conversation.');
  }
}

export class DuplicateLabelNameError extends DomainError {
  constructor() {
    super('DUPLICATE_LABEL_NAME', 'A label with this name already exists.');
  }
}

export class PlanLimitExceededError extends DomainError {
  constructor(resource: string) {
    super('PLAN_LIMIT_EXCEEDED', `Plan limit exceeded for ${resource}. Upgrade your plan to add more.`);
  }
}

export class SubscriptionNotFoundError extends DomainError {
  constructor() {
    super('SUBSCRIPTION_NOT_FOUND', 'No active subscription found for this tenant.');
  }
}
