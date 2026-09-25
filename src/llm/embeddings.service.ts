import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
const EMBEDDING_MODEL = 'text-embedding-3-small';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_KEY;
    if (!apiKey) {
      this.logger.warn(
        'OPENAI_KEY is not set; question indexing will fail at runtime.',
      );
    }
    this.client = new OpenAI({ apiKey, timeout: 60_000 });
  }

  async embed(text: string): Promise<number[]> {
    if (!text?.trim()) {
      throw new Error('Text is required for embedding');
    }
    const res = await this.client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim(),
      encoding_format: 'float',
    });
    const embedding = res.data?.[0]?.embedding;
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('OpenAI returned no embedding');
    }
    return embedding;
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    const input = texts.map((text) => text.trim()).filter(Boolean);
    if (!input.length) return [];

    const response = await this.client.embeddings.create({
      model: EMBEDDING_MODEL,
      input,
      encoding_format: 'float',
    });
    return [...response.data]
      .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
      .map((item) => item.embedding ?? []);
  }

  get dimension() {
    return 1536;
  }
}
