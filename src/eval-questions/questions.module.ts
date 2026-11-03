import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QuestionsController } from './questions.controller';
import { QuestionsCrudService } from './questions.crud.service';
import { RbacModule } from 'src/rbac/rbac.module';
import { LlmModule } from 'src/llm/llm.module';
import { VectorModule } from 'src/vector/vector.module';
import { QuestionsGenerateController } from './questions-generate.controller';
import { QuestionsService } from './questions.service';
import { QuestionsProcessor } from './questions.processor';
import { QuestionIndexOutboxProcessor } from './question-index-outbox.processor';
import { QuestionIndexOutboxScheduler } from './question-index-outbox.scheduler';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'llm-generation' },
      { name: 'question-index-outbox' },
      { name: 'question-index' },
    ),
    LlmModule,
    VectorModule,
    RbacModule,
  ],
  controllers: [QuestionsController, QuestionsGenerateController],
  providers: [
    QuestionsCrudService,
    QuestionsService,
    QuestionsProcessor,
    QuestionIndexOutboxProcessor,
    QuestionIndexOutboxScheduler,
  ],
})
export class QuestionsModule {}
