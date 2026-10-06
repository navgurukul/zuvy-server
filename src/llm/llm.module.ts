import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { EmbeddingsService } from './embeddings.service';
import { LLMUsageService } from './llmUsage.service';

@Module({
  controllers: [LlmController],
  providers: [LlmService, LLMUsageService, EmbeddingsService],
  exports: [LlmService, LLMUsageService, EmbeddingsService],
})
export class LlmModule {}
