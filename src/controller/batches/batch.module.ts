import { Module } from '@nestjs/common';
import { BatchesController } from './batch.controller';
import { BatchesService } from './batch.service';
import { BootcampModule } from '../bootcamp/bootcamp.module';
@Module({
    controllers: [BatchesController],
    providers: [BatchesService],
    // exports: [BatchesService],
    // imports: [BootcampModule]
})
export class BatchesModule {
    
}
