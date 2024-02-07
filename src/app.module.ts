import { Module } from '@nestjs/common';
import { BootcampModule } from './controller/bootcamp/bootcamp.module';
import { ConfigModule } from '@nestjs/config';
import { BatchesModule } from './controller/batches/batch.module';
import { ClassesModule } from './controller/classes/classes.module';
@Module({
  imports: [ConfigModule.forRoot(), BootcampModule, BatchesModule, ClassesModule ],
})
export class AppModule {
  
}
