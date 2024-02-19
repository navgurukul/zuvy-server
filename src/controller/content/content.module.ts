import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { BatchesModule } from '../batches/batch.module';

@Module({
    controllers: [ContentController],
    providers: [ContentService],
    // imports: [BatchesModule],
    // exports: [ContentService]
})
export class ContentModule {
    
}
