import { z } from 'zod';
import { stripFencesAndNoise } from './evaluationParser';

export const QuestionExplanationSchema = z.object({
  statedCorrectOption: z.coerce.number().int(),
  explanation: z.string().min(1),
});

function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return raw.slice(start, i + 1);
  }
  return null;
}

export function parseQuestionExplanation(raw: string | null) {
  if (!raw?.trim()) return null;
  const jsonChunk = extractFirstJsonObject(stripFencesAndNoise(raw));
  if (!jsonChunk) return null;
  try {
    const result = QuestionExplanationSchema.safeParse(JSON.parse(jsonChunk));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
