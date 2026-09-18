import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

export interface QuestionVectorPoint {
  id: number;
  vector: number[];
  payload: Record<string, unknown>;
}

@Injectable()
export class VectorService {
  private readonly client: QdrantClient;

  constructor(config: ConfigService) {
    const url =
      config.get<string>('QDRANT_URL') ||
      config.get<string>('VECTOR_QDRANT_URL') ||
      process.env.QDRANT_URL ||
      process.env.VECTOR_QDRANT_URL ||
      'http://127.0.0.1:6333';
    const apiKey =
      config.get<string>('QDRANT_ADMIN_KEY') || process.env.QDRANT_ADMIN_KEY;
    this.client = new QdrantClient({ url, apiKey });
  }

  async ensureCollection(collectionName: string, vectorSize: number) {
    if (await this.client.collectionExists(collectionName)) return;
    await this.client.createCollection(collectionName, {
      vectors: { size: vectorSize, distance: 'Cosine' },
    });
  }

  async upsert(collectionName: string, points: QuestionVectorPoint[]) {
    if (!points.length) return;
    await this.client.upsert(collectionName, {
      wait: true,
      points,
    });
  }
}
