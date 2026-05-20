/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Req,
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
import { SkipOrgCheck } from 'src/rbac/decorators/skip-org-check.decorator';

@ApiTags('Resume')
@ApiBearerAuth('JWT-auth')
@SkipOrgCheck()
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
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ success: boolean; data: ResumeResponseDto; resumeUrl: string }> {
    if (!file) {
      throw new BadRequestException('Resume file is required (PDF or DOCX)');
    }

    const userId = req.user[0]?.id;

    const parseResult = await this.learnerResumeService.parseResume(file);

    let resumeUrl = '';
    try {
      const uploadResult = await this.learnerResumeService.uploadResumeAndSave(
        file,
        userId,
        parseResult.data.projects || [],
      );
      resumeUrl = uploadResult.resumeUrl;
    } catch {}

    return {
      ...parseResult,
      resumeUrl,
    };
  }

  @Get('parsed')
  @ApiOperation({
    summary: 'Fetch resume from S3, parse it, and return extracted data',
  })
  async getParsedResume(@Req() req): Promise<{
    success: boolean;
    resumeUrl: string;
    originalFilename: string;
    data: ResumeResponseDto;
  }> {
    const userId = req.user[0]?.id;
    const result =
      await this.learnerResumeService.getParsedResumeFromS3(userId);
    return { success: true, ...result };
  }
}
