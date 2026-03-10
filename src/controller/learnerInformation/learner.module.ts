import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from 'src/auth/auth.module';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
import { LearnerController } from './learner.controller';
import { LearnerService } from './learner.service';
import { LearnerResumeController } from './learner.resume.controller';
import { LearnerResumeService } from './learner.resume.service';
import { LearnerProfileController } from './learner.profile.controller';
import { LearnerProfileService } from './learner.profile.service';

@Module({
  imports: [AuthModule],
  controllers: [
    LearnerController,
    LearnerResumeController,
    LearnerProfileController,
  ],
  providers: [
    LearnerService,
    LearnerResumeService,
    LearnerProfileService,
    JwtService,
  ],
})
export class LearnerModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes('*');
  }
}
