import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AdminAssessmentController } from './adminAssessment.controller';
import { AdminAssessmentService } from './adminAssessment.service';
import { BatchesModule } from '../batches/batch.module';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [AdminAssessmentController],
    providers: [AdminAssessmentService, JwtService],
})
export class AdminAssessmentModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(JwtMiddleware).forRoutes('*'); // Apply JwtMiddleware to all routes
    }
}
