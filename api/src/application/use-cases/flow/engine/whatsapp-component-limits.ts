const PLAIN_BODY_MAX_LENGTH = 4096;
const INTERACTIVE_BODY_MAX_LENGTH = 1024;

export const WHATSAPP_COMPONENT_LIMITS = {
  text: { bodyMaxLength: PLAIN_BODY_MAX_LENGTH },
  ask: { bodyMaxLength: PLAIN_BODY_MAX_LENGTH },
  internalNote: { bodyMaxLength: PLAIN_BODY_MAX_LENGTH },
  buttons: {
    bodyMaxLength: INTERACTIVE_BODY_MAX_LENGTH,
    minButtons: 1,
    maxButtons: 3,
    titleMaxLength: 20,
  },
  list: {
    bodyMaxLength: PLAIN_BODY_MAX_LENGTH,
    minRows: 1,
    maxRows: 10,
    rowTitleMaxLength: 24,
    rowDescriptionMaxLength: 72,
    buttonTextMaxLength: 20,
  },
  ctaUrl: {
    bodyMaxLength: INTERACTIVE_BODY_MAX_LENGTH,
    buttonTextMaxLength: 20,
    urlMustBeHttps: true,
  },
  form: { bodyMaxLength: INTERACTIVE_BODY_MAX_LENGTH, ctaMaxLength: 30 },
  requestLocation: { bodyMaxLength: INTERACTIVE_BODY_MAX_LENGTH },
  media: { documentFilenameMaxLength: 240 },
  reaction: { maxEmojis: 1 },
  typing: { minSeconds: 1, maxSeconds: 25 },
  aiRoute: { minOptions: 2, maxOptions: 6 },
  assistantNameMaxLength: 60,
  eventNameMaxLength: 60,
  triggerKeywordsMaxCount: 20,
  graph: { maxNodes: 100, maxEdges: 300 },
  maxWaitDays: 7,
} as const;

export const WHATSAPP_COMPONENT_LIMIT_NOTES = [
  'Buttons and lists are rendered by WhatsApp itself: exceeding a limit is rejected by Meta, not truncated.',
  'A message that carries buttons or a link button has a shorter body than a plain text message.',
  'Audio and sticker messages cannot carry a caption.',
  'A reaction targets the last customer message; if the customer has not written yet the step is skipped.',
  'Free-form messages require the 24-hour customer service window. Outside it, only approved templates go through.',
] as const;
