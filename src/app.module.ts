import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { LoggingInterceptor } from './loggerInterceptor/logger';
import { ScheduleModule } from '@nestjs/schedule';
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
import { ScheduleService } from './schedule/schedule.service';
import { InstructorModule } from './controller/instructor/instructor.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot(),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET_KEY,
      signOptions: { expiresIn: '24h' },
    }),
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
  ],
  providers: [
    ScheduleService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ]
})
export class AppModule { }
