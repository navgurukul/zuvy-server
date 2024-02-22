import { Module } from '@nestjs/common';
import { BootcampModule } from './controller/bootcamp/bootcamp.module';
import { ConfigModule } from '@nestjs/config';
import { BatchesModule } from './controller/batches/batch.module';
import { ClassesModule } from './controller/classes/classes.module';
import { ContentModule } from './controller/content/content.module';
import { StudentModule } from './controller/student/student.module';
import { TrackingModule } from './controller/progress/tracking.module'
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './loggerInterceptor/logger';
import {DriveModule} from './controller/classDriveUpload/drive.module';
@Module({
  imports: [ConfigModule.forRoot(), BootcampModule, BatchesModule, ClassesModule, ContentModule, StudentModule, TrackingModule,DriveModule],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {
  
}
