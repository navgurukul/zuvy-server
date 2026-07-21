import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { BatchesModule } from '../batches/batch.module';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
import { ClassesModule } from '../classes/classes.module';
import { AuthModule } from 'src/auth/auth.module';
import { TrackinglogModule } from 'src/trackinglog/trackinglog.module';
import { AttendanceCalculationModule } from 'src/services/attendance/attendance-calculation.module';

@Module({
  imports: [
    AuthModule,
    BatchesModule,
    ClassesModule,
    TrackinglogModule,
    AttendanceCalculationModule,
  ],
  controllers: [StudentController],
  providers: [StudentService, JwtService],
})
export class StudentModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes('*'); // Apply JwtMiddleware to all routes
  }
}
