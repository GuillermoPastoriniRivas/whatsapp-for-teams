import type { RegisteredTool } from './tool-registry.js';
import type { ContactDirectiveHandler } from '../handlers/contact-directive.handler.js';

export function createContactTools(
  contactHandler: ContactDirectiveHandler,
): RegisteredTool[] {
  return [
    {
      definition: {
        name: 'update_contact',
        description: 'Save customer information learned during the conversation. Only save data explicitly provided by the customer — never save information from your own responses.',
        parameters: {
          type: 'object',
          properties: {
            field: {
              type: 'string',
              description: 'The field to update. Use: "name", "email", "company", "notes", or "custom.<key>" for custom fields (e.g. "custom.direccion" for address, "custom.metodo_pago" for preferred payment method).',
            },
            value: { type: 'string', description: 'The value to save' },
          },
          required: ['field', 'value'],
        },
      },
      handler: async (args, ctx) => {
        const field = args.field as string;
        const value = args.value as string;
        if (!field || !value) return 'Error: field and value are required';

        try {
          return await contactHandler.handleAction(
            { field, value },
            ctx.contactId,
            ctx.conversationId,
            ctx.tenantId,
            ctx.agentId,
          );
        } catch (error: any) {
          return `Error updating contact: ${error.message}`;
        }
      },
    },
  ];
}
