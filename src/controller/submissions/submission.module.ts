import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { SubmissionController } from './submission.controller';
import { SubmissionService } from './submission.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
import { AuthModule } from 'src/auth/auth.module';
import { RbacModule } from 'src/rbac/rbac.module';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [SubmissionController],
  providers: [SubmissionService, JwtService],
  exports: [SubmissionService],
})
export class SubmissionModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes('*');
  }
}
