import { Module } from '@nestjs/common';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { BatchesModule } from '../batches/batch.module';
@Module({
    controllers: [StudentController],
    providers: [StudentService],
    imports: [BatchesModule],
})
export class StudentModule {
    
}
