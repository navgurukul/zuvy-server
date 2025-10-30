import { Module } from '@nestjs/common';
import { QuestionsByLlmService } from './questions-by-llm.service';
import { QuestionsByLlmController } from './questions-by-llm.controller';
import { QuestionEvaluationService } from './question-evaluation.service';
import { QuestionsEvaluationController } from './question-evaluation.controller';

@Module({
  controllers: [QuestionsByLlmController, QuestionsEvaluationController],
  providers: [QuestionsByLlmService, QuestionEvaluationService],
  exports: [QuestionEvaluationService],
})
export class QuestionsByLlmModule {}
