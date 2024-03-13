import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { BatchesController } from './batch.controller';
import { BatchesService } from './batch.service';
import { BootcampModule } from '../bootcamp/bootcamp.module';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
@Module({
  controllers: [BatchesController],
  providers: [BatchesService, JwtService],
  // exports: [BatchesService],
  // imports: [BootcampModule]
})
export class BatchesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes('*'); // Apply JwtMiddleware to all routes
  }
}
