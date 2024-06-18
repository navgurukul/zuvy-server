import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { BatchesModule } from '../batches/batch.module';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';

@Module({
  controllers: [ContentController],
  providers: [ContentService, JwtService],
  // exports: [ContentService]
})
export class ContentModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes('*'); // Apply JwtMiddleware to all routes
  }
}
