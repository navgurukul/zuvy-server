import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { BatchesModule } from '../batches/batch.module';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
import { ZoomModule } from '../../services/zoom/zoom.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  controllers: [ClassesController],
  providers: [ClassesService, JwtService],
  imports: [BatchesModule, ZoomModule, AuthModule],
  exports: [ClassesService],
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