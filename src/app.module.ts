import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { LoggingInterceptor } from './loggerInterceptor/logger';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { BootcampModule } from './controller/bootcamp/bootcamp.module';
import { ConfigModule } from '@nestjs/config';
import { BatchesModule } from './controller/batches/batch.module';
import { ClassesModule } from './controller/classes/classes.module';
import { ContentModule } from './controller/content/content.module';
import { StudentModule } from './controller/student/student.module';
import { TrackingModule } from './controller/progress/tracking.module';
import { CodingPlatformModule } from './controller/codingPlatform/codingPlatform.module';
import { SubmissionModule } from './controller/submissions/submission.module';
import { AdminAssessmentModule } from './controller/adminAssessment/adminAssessment.module';
import { ScheduleModule } from './schedule/schedule.module';
import { InstructorModule } from './controller/instructor/instructor.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    NestScheduleModule.forRoot(),
    ConfigModule.forRoot(),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET_KEY,
      signOptions: { expiresIn: '24h' },
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    AdminAssessmentModule,
    BootcampModule,
    BatchesModule,
    ClassesModule,
    CodingPlatformModule,
    ContentModule,
    StudentModule,
    SubmissionModule,
    TrackingModule,
    InstructorModule,
    ScheduleModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ]
})
export class AppModule { }
