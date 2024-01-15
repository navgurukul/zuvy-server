import { Module } from '@nestjs/common';
import { BootcampController } from './bootcamp.controller';
import { BootcampService } from './bootcamp.service';
import { BatchesModule } from '../batches/batch.module';
@Module({
    controllers: [BootcampController],
    providers: [BootcampService],
    imports: [BatchesModule],
})
export class BootcampModule {
    
}
