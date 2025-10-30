import { Module } from '@nestjs/common';
import { AiAssessmentService } from './ai-assessment.service';
import { AiAssessmentController } from './ai-assessment.controller';

@Module({
  controllers: [AiAssessmentController],
  providers: [AiAssessmentService],
})
export class AiAssessmentModule {}
