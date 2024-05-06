import { Module ,NestModule,MiddlewareConsumer} from '@nestjs/common';
import { SubmissionController } from './submission.controller';
import { SubmissionService } from './submission.service';
import { JwtModule,JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
@Module({
    controllers: [SubmissionController],
    providers: [SubmissionService,JwtService],
})
export class SubmissionModule implements NestModule {
   configure(consumer: MiddlewareConsumer) {
        consumer.apply(JwtMiddleware).forRoutes('*'); // Apply JwtMiddleware to all routes
    }
}