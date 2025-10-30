import { Module } from '@nestjs/common';
import { AiAssessmentService } from './ai-assessment.service';
import { AiAssessmentController } from './ai-assessment.controller';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AiAssessmentController],
  providers: [AiAssessmentService],
})
export class AiAssessmentModule {}
