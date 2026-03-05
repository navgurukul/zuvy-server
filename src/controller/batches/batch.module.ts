import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { BatchesController } from './batch.controller';
import { BatchesService } from './batch.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
import { AuthModule } from 'src/auth/auth.module';
import { TrackinglogModule } from '../../trackinglog/trackinglog.module';
@Module({
  imports: [AuthModule, TrackinglogModule],
  controllers: [BatchesController],
  providers: [BatchesService, JwtService],
  exports: [BatchesService],
})
export class BatchesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes('*');
  }
}
