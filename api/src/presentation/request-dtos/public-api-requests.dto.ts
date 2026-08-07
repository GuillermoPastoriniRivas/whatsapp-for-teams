import { z } from 'zod';

const LocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string().max(200).optional(),
  address: z.string().max(300).optional(),
});

/** Meta exige `name.formatted_name`; el resto de la tarjeta es opcional. */
const ContactCardSchema = z.object({
  name: z.object({
    formatted_name: z.string().min(1).max(200),
    first_name: z.string().max(100).optional(),
    last_name: z.string().max(100).optional(),
  }),
  phones: z
    .array(z.object({ phone: z.string().max(30), type: z.string().max(20).optional(), wa_id: z.string().max(20).optional() }))
    .max(10)
    .optional(),
  emails: z.array(z.object({ email: z.string().max(200), type: z.string().max(20).optional() })).max(10).optional(),
  org: z
    .object({ company: z.string().max(120).optional(), department: z.string().max(120).optional(), title: z.string().max(120).optional() })
    .optional(),
});

/**
 * Los topes de longitud son los de Meta; pasarse los rechaza con un error
 * genérico, así que conviene cortar acá con un mensaje que se entienda.
 */
const InteractiveSchema = z.object({
  kind: z.enum(['buttons', 'list', 'cta_url', 'location_request', 'address_message']),
  body: z.string().min(1).max(4096),
  header: z.string().max(60).optional(),
  footer: z.string().max(60).optional(),
  buttons: z.array(z.object({ id: z.string().max(256), title: z.string().max(20) })).max(3).optional(),
  buttonText: z.string().max(20).optional(),
  rows: z
    .array(z.object({ id: z.string().max(200), title: z.string().max(24), description: z.string().max(72).optional() }))
    .max(10)
    .optional(),
  url: z.string().url().optional(),
  /** ISO-2. El formulario de dirección sólo existe en algunos mercados. */
  country: z.string().length(2).optional(),
});

export const PublicSendMessageRequestSchema = z
  .object({
    /** Número destino en formato internacional (con o sin +) */
    to: z.string().min(8).max(20),
    phoneNumberId: z.string().optional(),
    contactName: z.string().max(120).optional(),
    body: z.string().min(1).max(4096).optional(),
    templateId: z.string().optional(),
    variables: z.record(z.string(), z.string()).optional(),
    location: LocationSchema.optional(),
    contacts: z.array(ContactCardSchema).max(10).optional(),
    interactive: InteractiveSchema.optional(),
    /** Emoji sobre otro mensaje. Vacío quita la reacción. */
    reaction: z.object({ waMessageId: z.string().min(1), emoji: z.string().max(16) }).optional(),
    /** Responder citando: wamid de un mensaje de la conversación. */
    replyToWaMessageId: z.string().min(1).optional(),
    /** Mandar la plantilla por Marketing Messages Lite. Sólo aplica a marketing. */
    marketingLite: z.boolean().optional(),
  })
  .refine(
    (data) =>
      !!data.body || !!data.templateId || !!data.location || !!data.contacts?.length || !!data.interactive || !!data.reaction,
    { message: 'Provide `templateId` or free-form content: `body`, `location`, `contacts`, `interactive` or `reaction`' },
  )
  .refine((data) => data.interactive?.kind !== 'cta_url' || !!data.interactive.url, {
    message: '`interactive.url` is required for kind `cta_url`',
    path: ['interactive', 'url'],
  })
  .refine((data) => data.interactive?.kind !== 'address_message' || !!data.interactive.country, {
    message: '`interactive.country` is required for kind `address_message`',
    path: ['interactive', 'country'],
  });
export type PublicSendMessageRequestDto = z.infer<typeof PublicSendMessageRequestSchema>;

export const PublicConversationMessageRequestSchema = z.object({
  body: z.string().min(1).max(4096),
});
export type PublicConversationMessageRequestDto = z.infer<typeof PublicConversationMessageRequestSchema>;

export const PublicCreateContactRequestSchema = z.object({
  phone: z.string().min(8).max(20),
  name: z.string().max(120).optional(),
});
export type PublicCreateContactRequestDto = z.infer<typeof PublicCreateContactRequestSchema>;
