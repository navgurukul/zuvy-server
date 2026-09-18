import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

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

  async embedMany(texts: string[]): Promise<number[][]> {
    const input = texts.map((text) => text.trim()).filter(Boolean);
    if (!input.length) return [];

    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
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
