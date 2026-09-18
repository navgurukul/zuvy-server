import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LlmModule } from 'src/llm/llm.module';
import { VectorModule } from 'src/vector/vector.module';
import { QuestionsByLlmService } from './questions-by-llm.service';
import { QuestionsByLlmController } from './questions-by-llm.controller';
import { QuestionEvaluationService } from './question-evaluation.service';
import { QuestionsEvaluationController } from './question-evaluation.controller';
import { RbacModule } from 'src/rbac/rbac.module';
import { TrackinglogModule } from 'src/trackinglog/trackinglog.module';
import { QuestionsGenerationProcessor } from './questions-generation.processor';
import { QuestionIndexProcessor } from './question-index.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'llm-generation' },
      { name: 'question-index' },
    ),
    LlmModule,
    VectorModule,
    RbacModule,
    TrackinglogModule,
  ],
  controllers: [QuestionsByLlmController, QuestionsEvaluationController],
  providers: [
    QuestionsByLlmService,
    QuestionsGenerationProcessor,
    QuestionIndexProcessor,
    QuestionEvaluationService,
  ],
  exports: [QuestionEvaluationService, QuestionsByLlmService],
})
export class QuestionsByLlmModule {}
