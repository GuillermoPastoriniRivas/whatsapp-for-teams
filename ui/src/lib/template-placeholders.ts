// Espejo de template-variable.resolver.ts del backend: qué valores pide una
// plantilla y cómo se llama cada uno. Vive acá y no en un componente porque lo
// usan el envío desde el chat y el envío suelto desde la página de plantillas,
// y las dos pantallas tienen que pedir exactamente lo mismo que el backend
// valida.

import type { MessageTemplate, TemplateComponent } from "@/types";

export const PLACEHOLDER_REGEX = /\{\{([a-z0-9_]+)\}\}/gi;

/** Formatos de header que se resuelven con un link. LOCATION no, y no se pide. */
const LINK_HEADER_FORMATS = new Set(["IMAGE", "VIDEO", "DOCUMENT"]);

export interface Placeholder {
  /** Clave canónica que espera el backend: body.1, header.link, button.0.1 */
  key: string;
  label: string;
  isLink: boolean;
}

function extract(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_REGEX)].map((m) => m[1]);
}

export function listPlaceholders(components: TemplateComponent[]): Placeholder[] {
  const found: Placeholder[] = [];

  for (const c of components) {
    if (c.type === "BODY" && c.text) {
      for (const pos of extract(c.text)) {
        found.push({ key: `body.${pos}`, label: `{{${pos}}}`, isLink: false });
      }
    } else if (c.type === "HEADER") {
      if (c.format === "TEXT" && c.text) {
        for (const pos of extract(c.text)) {
          found.push({ key: `header.${pos}`, label: `Header {{${pos}}}`, isLink: false });
        }
      } else if (c.format && LINK_HEADER_FORMATS.has(c.format)) {
        found.push({ key: "header.link", label: c.format, isLink: true });
      }
    } else if (c.type === "BUTTONS") {
      (c.buttons ?? []).forEach((b, i) => {
        if (b.type === "URL" && b.url) {
          for (const pos of extract(b.url)) {
            found.push({ key: `button.${i}.${pos}`, label: `${b.text} {{${pos}}}`, isLink: false });
          }
        } else if (b.type === "COPY_CODE") {
          found.push({ key: `button.${i}.code`, label: b.text, isLink: false });
        }
      });
    }
  }

  // sin duplicados (el mismo placeholder puede repetirse en el texto)
  return found.filter((p, i) => found.findIndex((q) => q.key === p.key) === i);
}

export function templateBody(template: MessageTemplate): string {
  return template.components.find((c) => c.type === "BODY")?.text ?? "";
}

export function renderPreview(
  template: MessageTemplate,
  variables: Record<string, string>,
): string {
  return templateBody(template).replace(
    PLACEHOLDER_REGEX,
    (match, pos) => variables[`body.${pos}`] || match,
  );
}
