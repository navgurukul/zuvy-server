
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ListFilesService } from './drive.service';

@Module({
  imports: [ScheduleModule.forRoot()],
    providers: [ListFilesService],
})
export class FileUploadModule {}
