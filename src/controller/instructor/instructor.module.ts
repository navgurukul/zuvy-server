import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { InstructorController } from './instructor.controller';
import { InstructorService } from './instructor.service';
import { BatchesModule } from '../batches/batch.module';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';

@Module({
  controllers: [InstructorController],
  providers: [InstructorService, JwtService],
  
})
export class InstructorModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes('*'); 
  }
}
