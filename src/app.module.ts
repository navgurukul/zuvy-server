import { Module } from '@nestjs/common';
import { BootcampModule } from './controller/bootcamp/bootcamp.module';
import { ConfigModule } from '@nestjs/config';
import { BatchesModule } from './controller/batches/batch.module';
import { ClassesModule } from './controller/classes/classes.module';
import { ContentModule } from './controller/content/content.module';
import { StudentModule } from './controller/student/student.module';
import { TrackingModule } from './controller/progress/tracking.module';
import { CodingPlatformModule } from './controller/codingPlatform/codingPlatform.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { LoggingInterceptor } from './loggerInterceptor/logger';


@Module({
  imports: [
    ConfigModule.forRoot(),
    JwtModule.register({
      global:true,
      secret: process.env.JWT_SECRET_KEY,
      signOptions: { expiresIn: '24h' },
    }),
    BootcampModule,
    BatchesModule,
    ClassesModule,
    ContentModule,
    StudentModule,
    TrackingModule,
    CodingPlatformModule
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
