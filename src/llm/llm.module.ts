import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { EmbeddingsService } from './embeddings.service';

@Module({
  controllers: [LlmController],
  providers: [LlmService, EmbeddingsService],
  exports: [LlmService, EmbeddingsService],
})
export class LlmModule {}
