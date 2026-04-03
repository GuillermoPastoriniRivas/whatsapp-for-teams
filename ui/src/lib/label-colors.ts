export const LABEL_COLORS: Record<string, { bg: string; darkBg: string; fg: string }> = {
  red:    { bg: "rgba(239,68,68,0.15)",  darkBg: "rgba(239,68,68,0.25)",  fg: "#dc2626" },
  orange: { bg: "rgba(249,115,22,0.15)", darkBg: "rgba(249,115,22,0.25)", fg: "#ea580c" },
  yellow: { bg: "rgba(234,179,8,0.15)",  darkBg: "rgba(234,179,8,0.25)",  fg: "#ca8a04" },
  green:  { bg: "rgba(34,197,94,0.15)",  darkBg: "rgba(34,197,94,0.25)",  fg: "#16a34a" },
  teal:   { bg: "rgba(20,184,166,0.15)", darkBg: "rgba(20,184,166,0.25)", fg: "#0d9488" },
  blue:   { bg: "rgba(59,130,246,0.15)", darkBg: "rgba(59,130,246,0.25)", fg: "#2563eb" },
  indigo: { bg: "rgba(99,102,241,0.15)", darkBg: "rgba(99,102,241,0.25)", fg: "#4f46e5" },
  purple: { bg: "rgba(168,85,247,0.15)", darkBg: "rgba(168,85,247,0.25)", fg: "#9333ea" },
  pink:   { bg: "rgba(236,72,153,0.15)", darkBg: "rgba(236,72,153,0.25)", fg: "#db2777" },
  gray:   { bg: "rgba(107,114,128,0.15)",darkBg: "rgba(107,114,128,0.25)",fg: "#6b7280" },
};

export const LABEL_COLOR_KEYS = Object.keys(LABEL_COLORS);

export function getLabelStyle(color: string, isDark = false) {
  const c = LABEL_COLORS[color] ?? LABEL_COLORS.gray;
  return {
    backgroundColor: isDark ? c.darkBg : c.bg,
    color: c.fg,
  };
}
