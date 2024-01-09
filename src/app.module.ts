import { Module } from '@nestjs/common';
import { BootcampModule } from './controller/bootcamp/bootcamp.module';
import { ConfigModule } from '@nestjs/config';
import { BatchesModule } from './controller/batches/batch.module';

@Module({
  imports: [ConfigModule.forRoot(), BootcampModule, BatchesModule ],
})
export class AppModule {
  
}
