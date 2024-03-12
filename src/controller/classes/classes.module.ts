import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { BatchesModule } from '../batches/batch.module';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
@Module({
  controllers: [ClassesController],
  providers: [ClassesService, JwtService],
  imports: [BatchesModule],
})
export class ClassesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes('*'); // Apply JwtMiddleware to all routes
  }
}
