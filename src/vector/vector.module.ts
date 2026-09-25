// import { Module } from '@nestjs/common';
// import { ConfigModule } from '@nestjs/config';
// import { VectorService } from './vector.service';

// @Module({
//   imports: [ConfigModule],
//   providers: [VectorService],
//   exports: [VectorService],
// })
// export class VectorModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { VectorService } from './vector.service';
import { VECTOR_STORE } from './constants';
import { QdrantVectorStore } from './strategies/qdrant.vector-store';

@Module({
  imports: [ConfigModule],
  providers: [
    VectorService,
    QdrantVectorStore,
    {
      provide: VECTOR_STORE,
      useExisting: QdrantVectorStore,
    },
  ],
  exports: [VectorService],
})
export class VectorModule {}
