// ── Template variable resolution ─────────────────────────────────
// Pure functions — no NestJS dependencies, no side effects.
//
// Two-phase design so recipients carry an immutable snapshot:
// 1. resolveVariables(template, mappings, contact) → flat { key: value } map,
//    stored on the CampaignRecipient at audience materialization time.
// 2. buildTemplatePayload(template, variables) → Meta send components +
//    rendered body text, rebuilt deterministically at send time.
//
// Variable keys are canonical: 'body.1', 'header.1', 'button.0.1' (button.<index>.<position>).

import { Contact } from '../../../../domain/entities/contact.entity.js';
import { MessageTemplateComponent } from '../../../../domain/entities/message-template.entity.js';
import { CampaignVariableMapping } from '../../../../domain/entities/campaign.entity.js';
import { TemplateSendComponent } from '../../../ports/messaging-api.port.js';

const PLACEHOLDER_REGEX = /\{\{([a-z0-9_]+)\}\}/gi;

export interface TemplatePlaceholder {
  component: 'header' | 'body' | 'button';
  index?: number;
  position: string;
}

export type ResolveResult =
  | { ok: true; variables: Record<string, string> }
  | { ok: false; missing: string[] };

export interface BuiltTemplatePayload {
  components: TemplateSendComponent[];
  renderedBody: string;
}

function extractPlaceholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_REGEX)].map((m) => m[1]);
}

function variableKey(placeholder: TemplatePlaceholder): string {
  return placeholder.component === 'button'
    ? `button.${placeholder.index}.${placeholder.position}`
    : `${placeholder.component}.${placeholder.position}`;
}

/** Lists every placeholder the template requires a value for. */
export function listTemplatePlaceholders(components: MessageTemplateComponent[]): TemplatePlaceholder[] {
  const placeholders: TemplatePlaceholder[] = [];

  for (const component of components) {
    if (component.type === 'BODY' && component.text) {
      for (const position of extractPlaceholders(component.text)) {
        placeholders.push({ component: 'body', position });
      }
    } else if (component.type === 'HEADER') {
      if (component.format === 'TEXT' && component.text) {
        for (const position of extractPlaceholders(component.text)) {
          placeholders.push({ component: 'header', position });
        }
      } else if (component.format && component.format !== 'TEXT') {
        // Media headers need a link supplied at send time.
        placeholders.push({ component: 'header', position: 'link' });
      }
    } else if (component.type === 'BUTTONS') {
      (component.buttons ?? []).forEach((button, index) => {
        if (button.type === 'URL' && button.url) {
          for (const position of extractPlaceholders(button.url)) {
            placeholders.push({ component: 'button', index, position });
          }
        } else if (button.type === 'COPY_CODE') {
          placeholders.push({ component: 'button', index, position: 'code' });
        }
      });
    }
  }

  return placeholders;
}

function resolveMappingValue(mapping: CampaignVariableMapping, contact: Contact): string | null {
  if (mapping.source === 'static') return mapping.value || null;

  const field = mapping.value;
  if (field.startsWith('customFields.')) {
    const key = field.slice('customFields.'.length);
    return contact.customFields?.[key] || null;
  }
  switch (field) {
    case 'name':
      return contact.name || null;
    case 'phone':
      return contact.phone || null;
    case 'email':
      return contact.email || null;
    case 'company':
      return contact.company || null;
    default:
      return null;
  }
}

/** Phase 1: resolve every template placeholder for one contact. */
export function resolveVariables(
  components: MessageTemplateComponent[],
  mappings: CampaignVariableMapping[],
  contact: Contact,
): ResolveResult {
  const variables: Record<string, string> = {};
  const missing: string[] = [];

  for (const placeholder of listTemplatePlaceholders(components)) {
    const key = variableKey(placeholder);
    const mapping = mappings.find(
      (m) =>
        m.component === placeholder.component &&
        m.position === placeholder.position &&
        (placeholder.component !== 'button' || m.index === placeholder.index),
    );
    const value = mapping ? resolveMappingValue(mapping, contact) : null;
    if (value === null) {
      missing.push(key);
    } else {
      variables[key] = value;
    }
  }

  return missing.length > 0 ? { ok: false, missing } : { ok: true, variables };
}

function substitute(text: string, prefix: string, variables: Record<string, string>): string {
  return text.replace(PLACEHOLDER_REGEX, (match, position) => variables[`${prefix}.${position}`] ?? match);
}

function isPositional(position: string): boolean {
  return /^\d+$/.test(position);
}

/** Phase 2: build the Meta send payload + rendered preview text from a variable snapshot. */
export function buildTemplatePayload(
  components: MessageTemplateComponent[],
  variables: Record<string, string>,
): BuiltTemplatePayload {
  const sendComponents: TemplateSendComponent[] = [];
  let renderedBody = '';

  for (const component of components) {
    if (component.type === 'BODY' && component.text) {
      renderedBody = substitute(component.text, 'body', variables);
      const positions = [...new Set(extractPlaceholders(component.text))];
      if (positions.length > 0) {
        sendComponents.push({
          type: 'body',
          parameters: positions.map((position) => ({
            type: 'text' as const,
            text: variables[`body.${position}`] ?? '',
            ...(isPositional(position) ? {} : { parameter_name: position }),
          })),
        });
      }
    } else if (component.type === 'HEADER') {
      if (component.format === 'TEXT' && component.text) {
        const positions = [...new Set(extractPlaceholders(component.text))];
        if (positions.length > 0) {
          sendComponents.push({
            type: 'header',
            parameters: positions.map((position) => ({
              type: 'text' as const,
              text: variables[`header.${position}`] ?? '',
              ...(isPositional(position) ? {} : { parameter_name: position }),
            })),
          });
        }
      } else if (component.format && component.format !== 'TEXT') {
        const link = variables['header.link'];
        if (link) {
          const mediaType = component.format.toLowerCase() as 'image' | 'video' | 'document';
          sendComponents.push({
            type: 'header',
            parameters: [{ type: mediaType, [mediaType]: { link } } as TemplateSendComponent['parameters'][number]],
          });
        }
      }
    } else if (component.type === 'BUTTONS') {
      (component.buttons ?? []).forEach((button, index) => {
        if (button.type === 'URL' && button.url) {
          const positions = extractPlaceholders(button.url);
          if (positions.length > 0) {
            sendComponents.push({
              type: 'button',
              sub_type: 'url',
              index,
              parameters: positions.map((position) => ({
                type: 'text' as const,
                text: variables[`button.${index}.${position}`] ?? '',
              })),
            });
          }
        } else if (button.type === 'COPY_CODE') {
          const code = variables[`button.${index}.code`];
          if (code) {
            sendComponents.push({
              type: 'button',
              sub_type: 'copy_code',
              index,
              parameters: [{ type: 'coupon_code', coupon_code: code }],
            });
          }
        }
      });
    }
  }

  return { components: sendComponents, renderedBody };
}
