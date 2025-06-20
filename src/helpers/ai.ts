import axios from 'axios';

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      { input: text, model: 'text-embedding-ada-002' },
      { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` } },
    );
    const embedding = response.data?.data?.[0]?.embedding;
    return embedding || null;
  } catch (error: any) {
    console.error('OpenAI embedding error', error?.message || error);
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}
