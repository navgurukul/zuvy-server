import { Inject, Injectable } from '@nestjs/common';
import { SearchVectorsDto } from './dto/search-vector.dto';
import { IVectorStore } from './interfaces/vector-store.interface';
import { VECTOR_STORE } from './constants';

@Injectable()
export class VectorService {
  constructor(
    @Inject(VECTOR_STORE)
    private readonly store: IVectorStore,
  ) {}

  async ensureCollection(collectionName: string, vectorSize: number) {
    return this.store.ensureCollection(collectionName, vectorSize);
  }

  async upsert(
    collectionName: string,
    points: {
      id: string;
      vector: number[];
      payload?: Record<string, string | number | boolean | null | string[]>;
    }[],
  ) {
    return this.store.upsert(collectionName, points);
  }

  async search(dto: SearchVectorsDto) {
    return this.store.search(dto.collectionName, dto.queryVector, {
      limit: dto.limit,
      filter: dto.filter,
    });
  }

  async delete(collectionName: string, ids: string[]) {
    return this.store.delete(collectionName, ids);
  }

  async createPayloadIndex(
    collectionName: string,
    fieldName: string,
    fieldSchema: 'keyword' | 'integer' | 'float' | 'bool',
  ) {
    return this.store.createPayloadIndex(
      collectionName,
      fieldName,
      fieldSchema,
    );
  }
}
