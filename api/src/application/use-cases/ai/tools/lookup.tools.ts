import type { RegisteredTool } from './tool-registry.js';
import type { TenantRepository } from '../../../../domain/repositories/tenant.repository.js';
import type { SearchKnowledgeUseCase } from '../../knowledge/knowledge.use-cases.js';
import { computeBusinessStatus } from '../prompts/business-hours.util.js';

export const KNOWLEDGE_EXCERPTS_PER_LOOKUP = 4;

export interface LookupToolsDeps {
  tenantRepo: TenantRepository;
  searchKnowledge?: SearchKnowledgeUseCase;
}

export function createLookupTools(deps: LookupToolsDeps): RegisteredTool[] {
  const tools: RegisteredTool[] = [];

  if (deps.searchKnowledge) {
    tools.push({
      definition: {
        name: 'search_knowledge',
        description:
          "Search the business's own documents for something you were not given up front. Use it whenever the customer " +
          'asks about a detail you cannot see — another treatment, a policy, a condition. If it returns nothing, the ' +
          'business never wrote that down: say you will check with the team instead of guessing.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'What to look up, in the words the business would use. E.g. "cuidados posteriores depilación".',
            },
          },
          required: ['query'],
        },
      },
      handler: async (args, ctx) => {
        const query = String(args.query ?? '').trim();
        if (!query) return 'Error: query is required';

        try {
          const excerpts = await deps.searchKnowledge!.execute(ctx.tenantId, query, KNOWLEDGE_EXCERPTS_PER_LOOKUP);
          if (excerpts.length === 0) {
            return 'Nothing found. The business has not written this down, so do not answer it yourself.';
          }
          return excerpts.map((e, i) => `[${i + 1}] From "${e.documentTitle}":\n${e.text}`).join('\n\n');
        } catch (error: any) {
          return `Could not search the knowledge base: ${error.message}`;
        }
      },
    });
  }

  tools.push({
    definition: {
      name: 'get_catalog',
      description:
        'The list of services or products the business sells, with their prices as the owner wrote them. Use it to ' +
        'check whether something exists and what it costs, instead of assuming.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
    handler: async (_args, ctx) => {
      const tenant = await deps.tenantRepo.findById(ctx.tenantId);
      const catalog = tenant?.businessProfile?.catalog ?? [];
      if (catalog.length === 0) return 'The catalogue is empty. Nothing is listed, so do not name prices.';

      return catalog
        .map((item) => [item.name, item.price, item.description].filter(Boolean).join(' · '))
        .join('\n');
    },
  });

  tools.push({
    definition: {
      name: 'get_business_hours',
      description:
        'Whether the business is open right now and what its opening hours are. Use it before saying anything about ' +
        'when the business attends. It does NOT tell you whether an appointment slot is free.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
    handler: async (_args, ctx) => {
      const tenant = await deps.tenantRepo.findById(ctx.tenantId);
      if (!tenant) return 'Could not read the account.';

      const status = computeBusinessStatus(tenant.businessHours, tenant.timezone, new Date());
      if (!status) return 'No opening hours are configured. Treat the business as open and do not mention hours.';

      const lines = [status.isOpen ? 'Open right now.' : 'Closed right now.'];
      if (status.todayRange) lines.push(`Today: ${status.todayRange.open} to ${status.todayRange.close}.`);
      if (status.nextOpen) lines.push(`Opens again ${status.nextOpen.day} at ${status.nextOpen.at}.`);
      lines.push('This is about opening hours only, never about whether a specific slot is available.');
      return lines.join(' ');
    },
  });

  return tools;
}
