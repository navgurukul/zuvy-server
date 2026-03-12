import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { LearnerResumeService } from './learner.resume.service';
import { ResumeResponseDto } from './dto/learner.dto';

@ApiTags('Resume')
@ApiBearerAuth('JWT-auth')
@Controller('resume')
export class LearnerResumeController {
  constructor(private readonly learnerResumeService: LearnerResumeService) {}

  @Post('parse')
  @ApiOperation({ summary: 'Parse uploaded resume (PDF or DOCX)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowedMimeTypes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Only PDF and DOCX resume files are allowed',
            ),
            false,
          );
        }

        cb(null, true);
      },
    }),
  )
  async parseResume(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ success: boolean; data: ResumeResponseDto }> {
    if (!file) {
      throw new BadRequestException('Resume file is required (PDF or DOCX)');
    }

    return this.learnerResumeService.parseResume(file);
  }
}
