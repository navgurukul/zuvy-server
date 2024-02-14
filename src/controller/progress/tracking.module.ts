import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { BatchesModule } from '../batches/batch.module';
@Module({
    controllers: [TrackingController],
    providers: [TrackingService],
    imports: [BatchesModule],
})
export class TrackingModule {
    
}
