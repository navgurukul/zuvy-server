import {
  Body,
  Controller,
  Get,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { LearnerService } from './learner.service';
import {
  CreateLearnerEducationMasterDataApiResponseDto,
  LearnerEducationMasterDataResponseDto,
  UpsertLearnerEducationMasterDataDto,
} from './dto/learner.dto';
@ApiTags('Learner Information')
@Controller('besic')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
@ApiBearerAuth('JWT-auth')
export class LearnerController {
  constructor(private readonly learnerService: LearnerService) {}

  @Get('learner-education-details')
  @ApiOperation({
    summary: 'Get learner education details (colleges, programTypes, branches)',
  })
  @ApiOkResponse({ type: CreateLearnerEducationMasterDataApiResponseDto })
  async getEducationMasterData(): Promise<{
    success: boolean;
    data: LearnerEducationMasterDataResponseDto;
  }> {
    return this.learnerService.getEducationMasterData();
  }

  @Post('learner-education-details')
  @ApiOperation({
    summary:
      'Save learner education master data (colleges, programTypes, branches) in one request',
  })
  @ApiBody({ type: UpsertLearnerEducationMasterDataDto })
  @ApiOkResponse({ type: CreateLearnerEducationMasterDataApiResponseDto })
  async createEducationMasterData(
    @Body() payload: UpsertLearnerEducationMasterDataDto,
  ): Promise<{
    success: boolean;
    data: LearnerEducationMasterDataResponseDto;
  }> {
    return this.learnerService.createEducationMasterData(payload);
  }
}
