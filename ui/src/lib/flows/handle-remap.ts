// Remapeo de conexiones cuando cambia la config de un nodo.
//
// Los handles de las opciones son posicionales (`btn:0`, `row:2`) o derivados
// de la clave (`opt:<key>`). Si al borrar la opción del medio se filtran las
// edges por "handle todavía válido", las ramas que quedan se corren y apuntan
// al nodo equivocado en silencio; y al editar una clave de ai_route el handle
// cambia en cada tecla y la rama se borraría. Por eso se remapea.

export type HandleRemap = Map<string, string | null>; // viejo → nuevo (null = eliminar)

function optionsOf(type: string, config: Record<string, any>): { family: string; items: unknown[] } | null {
  if (type === "action.send_buttons") return { family: "btn", items: Array.isArray(config.buttons) ? config.buttons : [] };
  if (type === "action.send_list") return { family: "row", items: Array.isArray(config.rows) ? config.rows : [] };
  if (type === "logic.ai_route") return { family: "opt", items: Array.isArray(config.options) ? config.options : [] };
  return null;
}

function handleFor(family: string, item: unknown, index: number): string {
  // ai_route usa la clave; botones y listas, el índice.
  if (family === "opt") return `opt:${(item as { key?: string })?.key ?? ""}`;
  return `${family}:${index}`;
}

/**
 * Compara la config previa con la nueva y devuelve cómo se movió cada handle.
 * Vacío = nada que remapear.
 */
export function computeHandleRemap(
  type: string,
  prevConfig: Record<string, any>,
  nextConfig: Record<string, any>,
): HandleRemap {
  const remap: HandleRemap = new Map();
  const prev = optionsOf(type, prevConfig);
  const next = optionsOf(type, nextConfig);
  if (!prev || !next) return remap;

  const prevHandles = prev.items.map((item, i) => handleFor(prev.family, item, i));
  const nextHandles = next.items.map((item, i) => handleFor(next.family, item, i));

  if (prev.items.length === next.items.length) {
    // Edición en el lugar (renombrar un botón o una clave): la posición manda.
    prevHandles.forEach((old, i) => {
      if (old !== nextHandles[i]) remap.set(old, nextHandles[i]);
    });
    return remap;
  }

  if (next.items.length === prev.items.length - 1) {
    // Se borró una opción: la primera posición que difiere marca cuál.
    let removed = prev.items.findIndex((item, i) => JSON.stringify(item) !== JSON.stringify(next.items[i]));
    if (removed === -1) removed = prev.items.length - 1;
    prevHandles.forEach((old, i) => {
      if (i === removed) remap.set(old, null);
      else if (i > removed) remap.set(old, nextHandles[i - 1]);
    });
    return remap;
  }

  // Se agregó una opción al final: los handles existentes no se mueven.
  return remap;
}
