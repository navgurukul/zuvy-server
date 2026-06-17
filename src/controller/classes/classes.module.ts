import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
import { AuthModule } from 'src/auth/auth.module';
import { ZoomModule } from '../../services/zoom/zoom.module';
import { TrackinglogModule } from 'src/trackinglog/trackinglog.module';
import { ZoomLicenseModule } from '../zoom-license/zoom-license.module';

@Module({
  imports: [AuthModule, ZoomModule, TrackinglogModule, ZoomLicenseModule],
  controllers: [ClassesController],
  providers: [ClassesService, JwtService],
  exports: [ClassesService],
})
export class ClassesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes('*');
  }
}
