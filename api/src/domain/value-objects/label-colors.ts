export const LABEL_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'pink',
  'gray',
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];
