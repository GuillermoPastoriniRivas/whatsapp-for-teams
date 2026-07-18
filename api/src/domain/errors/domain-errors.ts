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

export class InvalidTokenError extends DomainError {
  constructor() {
    super('INVALID_TOKEN', 'The token is invalid or has already been used.');
  }
}

export class TokenExpiredError extends DomainError {
  constructor() {
    super('TOKEN_EXPIRED', 'The token has expired. Please request a new one.');
  }
}

export class CheckoutCreationError extends DomainError {
  constructor(detail?: string) {
    super('CHECKOUT_CREATION_FAILED', detail ?? 'Failed to create checkout session.');
  }
}

export class WebhookVerificationError extends DomainError {
  constructor() {
    super('WEBHOOK_VERIFICATION_FAILED', 'Webhook signature verification failed.');
  }
}

export class PaymentProviderError extends DomainError {
  constructor(detail?: string) {
    super('PAYMENT_PROVIDER_ERROR', detail ?? 'Payment provider returned an error.');
  }
}

export class TemplateNotFoundError extends DomainError {
  constructor() {
    super('TEMPLATE_NOT_FOUND', 'Message template not found.');
  }
}

export class TemplateNotApprovedError extends DomainError {
  constructor() {
    super('TEMPLATE_NOT_APPROVED', 'The message template is not approved by Meta.');
  }
}

export class TemplateNotEditableError extends DomainError {
  constructor(status: string) {
    super('TEMPLATE_NOT_EDITABLE', `Templates in status '${status}' cannot be edited.`);
  }
}

export class TemplateInUseError extends DomainError {
  constructor() {
    super('TEMPLATE_IN_USE', 'The template is used by an active campaign. Pause or cancel it first.');
  }
}

export class TemplateProviderError extends DomainError {
  constructor(detail?: string) {
    super('TEMPLATE_PROVIDER_ERROR', detail ?? 'The messaging provider rejected the template operation.');
  }
}

export class WabaNotConfiguredError extends DomainError {
  constructor() {
    super('WABA_NOT_CONFIGURED', 'The phone number has no WhatsApp Business Account (wabaId) configured.');
  }
}

export class CampaignNotFoundError extends DomainError {
  constructor() {
    super('CAMPAIGN_NOT_FOUND', 'Campaign not found.');
  }
}

export class InvalidCampaignStateError extends DomainError {
  constructor(detail?: string) {
    super('INVALID_CAMPAIGN_STATE', detail ?? 'The campaign is not in a valid state for this operation.');
  }
}

export class CampaignAlreadyActiveOnPhoneError extends DomainError {
  constructor() {
    super('CAMPAIGN_ALREADY_ACTIVE_ON_PHONE', 'Another campaign is already active on this phone number.');
  }
}

export class InvalidVariableMappingError extends DomainError {
  constructor(detail: string) {
    super('INVALID_VARIABLE_MAPPING', detail);
  }
}

export class EmptyAudienceError extends DomainError {
  constructor() {
    super('EMPTY_AUDIENCE', 'The campaign audience resolved to zero valid recipients.');
  }
}
