export interface Directive {
  type: string;
  action: string;
  key: string;
  value: string;
  raw: string;
}

export interface ParseResult {
  cleanContent: string;
  directives: Directive[];
}

/**
 * Parses LLM output for structured directives like [TYPE:action:key:value]
 * and strips them from the customer-facing message.
 *
 * Supported formats:
 *   [LABEL:add:ventas]                       → type=LABEL, action=add, key=ventas
 *   [CONTACT:set:name:Juan Pérez]            → type=CONTACT, action=set, key=name, value=Juan Pérez
 *   [HANDOFF:escalate:reason text]           → type=HANDOFF, action=escalate, key=reason text
 *   [SUMMARY:set:summary text]               → type=SUMMARY, action=set, key=summary text
 *   [GOAL:complete:lead_qualified]           → type=GOAL, action=complete, key=lead_qualified
 */
export class DirectiveEngineDomainService {
  // Matches [TYPE:action:rest] where rest can contain one more colon for key:value pairs
  private static readonly DIRECTIVE_REGEX = /\[([A-Z_]+):([a-z_]+):([^\]]+)\]/gi;

  parse(content: string): ParseResult {
    const directives: Directive[] = [];
    const matches = content.matchAll(DirectiveEngineDomainService.DIRECTIVE_REGEX);

    for (const match of matches) {
      const type = match[1].toUpperCase();
      const action = match[2].toLowerCase();
      const rest = match[3];
      const raw = match[0];

      // For CONTACT directives, split rest into key:value (e.g. "name:Juan Pérez")
      // For others (LABEL, HANDOFF, SUMMARY, GOAL), rest is the key
      let key: string;
      let value: string;

      if (type === 'CONTACT') {
        const colonIdx = rest.indexOf(':');
        if (colonIdx !== -1) {
          key = rest.substring(0, colonIdx).trim();
          value = rest.substring(colonIdx + 1).trim();
        } else {
          key = rest.trim();
          value = '';
        }
      } else {
        key = rest.trim();
        value = '';
      }

      directives.push({ type, action, key, value, raw });
    }

    // Strip all directives from content
    const cleanContent = content
      .replace(DirectiveEngineDomainService.DIRECTIVE_REGEX, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { cleanContent, directives };
  }

  filterByType(directives: Directive[], type: string): Directive[] {
    return directives.filter((d) => d.type === type);
  }
}
