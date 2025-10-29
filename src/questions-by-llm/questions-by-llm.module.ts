import { Module } from '@nestjs/common';
import { QuestionsByLlmService } from './questions-by-llm.service';
import { QuestionsByLlmController } from './questions-by-llm.controller';

@Module({
  controllers: [QuestionsByLlmController],
  providers: [QuestionsByLlmService],
})
export class QuestionsByLlmModule {}
