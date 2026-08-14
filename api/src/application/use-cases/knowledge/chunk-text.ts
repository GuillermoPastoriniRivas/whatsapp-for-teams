export const CHUNK_TARGET_CHARS = 900;
export const CHUNK_OVERLAP_CHARS = 120;
export const CHUNK_MIN_CHARS = 40;

function splitOversizedParagraph(paragraph: string): string[] {
  const sentences = paragraph.match(/[^.!?\n]+[.!?]*\s*/g) ?? [paragraph];
  const pieces: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > CHUNK_TARGET_CHARS && current) {
      pieces.push(current.trim());
      current = '';
    }
    if (sentence.length > CHUNK_TARGET_CHARS) {
      for (let i = 0; i < sentence.length; i += CHUNK_TARGET_CHARS) {
        pieces.push(sentence.slice(i, i + CHUNK_TARGET_CHARS).trim());
      }
      continue;
    }
    current += sentence;
  }

  if (current.trim()) pieces.push(current.trim());
  return pieces.filter(Boolean);
}

function overlapTail(text: string): string {
  if (text.length <= CHUNK_OVERLAP_CHARS) return text;
  const tail = text.slice(-CHUNK_OVERLAP_CHARS);
  const boundary = tail.search(/\s/);
  return boundary === -1 ? tail : tail.slice(boundary + 1);
}

export function chunkText(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n\s*\n/).flatMap((paragraph) => {
    const trimmed = paragraph.trim();
    if (!trimmed) return [];
    return trimmed.length > CHUNK_TARGET_CHARS ? splitOversizedParagraph(trimmed) : [trimmed];
  });

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > CHUNK_TARGET_CHARS) {
      chunks.push(current.trim());
      current = `${overlapTail(current)}\n\n`;
    }
    current += `${paragraph}\n\n`;
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks.filter((chunk) => chunk.length >= CHUNK_MIN_CHARS || chunks.length === 1);
}
