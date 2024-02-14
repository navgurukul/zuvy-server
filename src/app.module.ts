import { Module } from '@nestjs/common';
import { BootcampModule } from './controller/bootcamp/bootcamp.module';
import { ConfigModule } from '@nestjs/config';
import { BatchesModule } from './controller/batches/batch.module';
import { ClassesModule } from './controller/classes/classes.module';
import { ContentModule } from './controller/content/content.module';
import { StudentModule } from './controller/student/student.module';
import { TrackingModule } from './controller/progress/tracking.module'

@Module({
  imports: [ConfigModule.forRoot(), BootcampModule, BatchesModule, ClassesModule, ContentModule, StudentModule, TrackingModule],
})
export class AppModule {
  
}
