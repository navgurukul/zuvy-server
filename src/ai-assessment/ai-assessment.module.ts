import { Module } from '@nestjs/common';
import { AiAssessmentService } from './ai-assessment.service';
import { AiAssessmentController } from './ai-assessment.controller';
import { AuthModule } from 'src/auth/auth.module';
import { LlmModule } from 'src/llm/llm.module';
import { QuestionsByLlmModule } from 'src/questions-by-llm/questions-by-llm.module';
import { AiAssessmentCrudService } from './ai-assessment.crud.service';
import { VectorModule } from 'src/vector/vector.module';
import { AiAssessmentMappingService } from './ai-assessment.mapping.service';
import { AiAssessmentMappingHelpers } from './ai-assessment.mapping.helpers';
import { TopicModule } from 'src/eval-topic/topic.module';

@Module({
  imports: [
    AuthModule,
    LlmModule,
    QuestionsByLlmModule,
    VectorModule,
    TopicModule,
  ],
  controllers: [AiAssessmentController],
  providers: [
    AiAssessmentService,
    AiAssessmentCrudService,
    AiAssessmentMappingHelpers,
    AiAssessmentMappingService,
  ],
})
export class AiAssessmentModule {}
