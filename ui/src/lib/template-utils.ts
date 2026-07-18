// Pure helpers for WhatsApp message-template placeholders ({{1}} positional, {{name}} named).

import type { Contact, TemplateComponent, VariableMapping } from "@/types";

export const TEMPLATE_PLACEHOLDER_RE = /\{\{\s*(\d+|[a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export interface PlaceholderRef {
  component: "header" | "body" | "button";
  /** Button index within the BUTTONS component (only for component === "button"). */
  index?: number;
  /** Placeholder key: "1", "2", ... or the named token. Media headers use "link". */
  position: string;
  /** Surrounding text fragment, for display in the variable-mapping UI. */
  context: string;
}

function tokensOf(text: string): string[] {
  return [...text.matchAll(TEMPLATE_PLACEHOLDER_RE)].map((m) => m[1]);
}

function contextAround(text: string, token: string): string {
  const idx = text.indexOf(`{{${token}}}`);
  if (idx === -1) return text.slice(0, 60);
  const start = Math.max(0, idx - 25);
  const end = Math.min(text.length, idx + token.length + 4 + 25);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

/** Lists every placeholder the template needs a value for, in header → body → buttons order. */
export function extractPlaceholders(components: TemplateComponent[]): PlaceholderRef[] {
  const refs: PlaceholderRef[] = [];
  const seen = new Set<string>();

  const push = (ref: PlaceholderRef) => {
    const key = `${ref.component}.${ref.index ?? ""}.${ref.position}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push(ref);
    }
  };

  for (const component of components) {
    if (component.type === "HEADER") {
      if ((component.format ?? "TEXT") === "TEXT" && component.text) {
        for (const token of tokensOf(component.text)) {
          push({ component: "header", position: token, context: contextAround(component.text, token) });
        }
      } else if (component.format && component.format !== "TEXT") {
        push({ component: "header", position: "link", context: component.format.toLowerCase() });
      }
    } else if (component.type === "BODY" && component.text) {
      for (const token of tokensOf(component.text)) {
        push({ component: "body", position: token, context: contextAround(component.text, token) });
      }
    } else if (component.type === "BUTTONS") {
      (component.buttons ?? []).forEach((button, index) => {
        if (button.type === "URL" && button.url) {
          for (const token of tokensOf(button.url)) {
            push({ component: "button", index, position: token, context: button.url! });
          }
        }
      });
    }
  }

  return refs;
}

/**
 * Meta rejects positional placeholders with gaps: they must be {{1}}, {{2}}, ...
 * Returns an error key ("gap") or null when valid.
 */
export function validateConsecutivePlaceholders(text: string): "gap" | null {
  const numbers = tokensOf(text)
    .filter((t) => /^\d+$/.test(t))
    .map((t) => parseInt(t, 10));
  if (numbers.length === 0) return null;
  const unique = [...new Set(numbers)].sort((a, b) => a - b);
  return unique[0] === 1 && unique[unique.length - 1] === unique.length ? null : "gap";
}

/** Canonical variable key used by the backend snapshot: body.1, header.link, button.0.1 */
export function variableKey(ref: Pick<PlaceholderRef, "component" | "index" | "position">): string {
  return ref.component === "button"
    ? `button.${ref.index}.${ref.position}`
    : `${ref.component}.${ref.position}`;
}

/** Substitutes tokens for preview; tokens without a value are kept as-is. */
export function renderTemplateText(text: string, prefix: "header" | "body", values: Record<string, string>): string {
  return text.replace(TEMPLATE_PLACEHOLDER_RE, (match, token) => values[`${prefix}.${token}`] ?? match);
}

/** Resolves one mapping against a sample contact (undefined = no value for this contact). */
export function resolveMappingSample(mapping: VariableMapping, contact: Contact): string | undefined {
  if (mapping.source === "static") return mapping.value || undefined;
  const field = mapping.value;
  if (field.startsWith("customFields.")) {
    return contact.customFields?.[field.slice("customFields.".length)] || undefined;
  }
  switch (field) {
    case "name":
      return contact.name || undefined;
    case "phone":
      return contact.phone || undefined;
    case "email":
      return contact.email || undefined;
    case "company":
      return contact.company || undefined;
    default:
      return undefined;
  }
}

/** Next unused positional number for the editor's "insert variable" button. */
export function nextPositionalToken(text: string): string {
  const numbers = tokensOf(text)
    .filter((t) => /^\d+$/.test(t))
    .map((t) => parseInt(t, 10));
  return `{{${numbers.length ? Math.max(...numbers) + 1 : 1}}}`;
}
