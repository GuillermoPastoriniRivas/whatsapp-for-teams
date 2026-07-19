// La API de WhatsApp no expone fotos de perfil de clientes: avatares de
// iniciales sobre fondos tintados suaves, en la familia visual de la marca
// (mismo tratamiento que bg-primary/10 del sidebar).
const AVATAR_STYLES = [
  "bg-primary/12 text-primary",
  "bg-accent/12 text-accent",
  "bg-sky-500/12 text-sky-700 dark:text-sky-400",
  "bg-violet-500/12 text-violet-700 dark:text-violet-400",
  "bg-rose-500/12 text-rose-700 dark:text-rose-400",
  "bg-amber-500/15 text-amber-700 dark:text-amber-400",
];

export function avatarStyle(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_STYLES[Math.abs(hash) % AVATAR_STYLES.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
