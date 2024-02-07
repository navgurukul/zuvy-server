import { Module } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { BatchesModule } from '../batches/batch.module';
@Module({
    controllers: [ClassesController],
    providers: [ClassesService],
    imports: [BatchesModule],
})
export class ClassesModule {
    
}
