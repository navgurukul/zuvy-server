import { Module } from '@nestjs/common';
import { AiAssessmentService } from './ai-assessment.service';
import { AiAssessmentController } from './ai-assessment.controller';
import { AuthModule } from 'src/auth/auth.module';
import { LlmModule } from 'src/llm/llm.module';
import { QuestionsByLlmModule } from 'src/questions-by-llm/questions-by-llm.module';

@Module({
  imports: [AuthModule, LlmModule, QuestionsByLlmModule],
  controllers: [AiAssessmentController],
  providers: [AiAssessmentService],
})
export class AiAssessmentModule {}
