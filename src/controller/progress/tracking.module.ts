import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { BatchesModule } from '../batches/batch.module';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
import { AuthModule } from 'src/auth/auth.module';

import { ContentModule } from '../content/content.module';
@Module({
    imports: [BatchesModule, AuthModule, ContentModule],
    controllers: [TrackingController],
    providers: [TrackingService, JwtService],
})
export class TrackingModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(JwtMiddleware).forRoutes('*'); // Apply JwtMiddleware to all routes
    }
}
