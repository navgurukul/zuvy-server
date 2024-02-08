import { Module } from '@nestjs/common';
import { BootcampModule } from './controller/bootcamp/bootcamp.module';
import { ConfigModule } from '@nestjs/config';
import { BatchesModule } from './controller/batches/batch.module';
import { ClassesModule } from './controller/classes/classes.module';
import { ContentModule } from './controller/content/content.module';
@Module({
  imports: [ConfigModule.forRoot(), BootcampModule, BatchesModule, ClassesModule, ContentModule],
})
export class AppModule {
  
}
