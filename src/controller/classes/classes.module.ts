import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
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
    consumer
      .apply(JwtMiddleware)
      .exclude(
        { path: '/classes/', method: RequestMethod.GET }, 
        { path: '/classes/redirect', method: RequestMethod.GET }, 
        { path: '/classes/getAllAttendance/:batchId', method: RequestMethod.GET }, 
        { path: '/classes/getAllAttendance/:batchId/', method: RequestMethod.GET }, 
      )
      .forRoutes('*'); 
  }
}