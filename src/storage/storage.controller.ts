import { Controller, Get, Param } from '@nestjs/common';
import { StorageService } from './storage.service';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('audio/:studentId/:assessmentId')
  getAudio(
    @Param('studentId') studentId: string,
    @Param('assessmentId') assessmentId: string,
  ) {
    return this.storageService.getAudioUrl(studentId, assessmentId);
  }
}
