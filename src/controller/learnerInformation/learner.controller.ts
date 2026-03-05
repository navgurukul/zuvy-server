import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  // ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { LearnerService } from './learner.service';
import {
  LearnerBoardsResponseDto,
  LearnerEducationMasterDataResponseDto,
  TechnicalSkillsResponseDto,
  UpdateLearnerBoardByIdDto,
  UpdateLearnerEducationMasterDataByIdDto,
  UpdateTechnicalSkillByIdDto,
  UpsertLearnerBoardsDto,
  UpsertTechnicalSkillsDto,
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
  async createEducationMasterData(
    @Body() payload: UpsertLearnerEducationMasterDataDto,
  ): Promise<{
    success: boolean;
    data: LearnerEducationMasterDataResponseDto;
  }> {
    return this.learnerService.createEducationMasterData(payload);
  }

  @Put('learner-education-details/:id')
  @ApiOperation({
    summary: 'Update learner education master data by id',
  })
  @ApiBody({ type: UpdateLearnerEducationMasterDataByIdDto })
  async updateEducationMasterData(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateLearnerEducationMasterDataByIdDto,
  ): Promise<{
    success: boolean;
    data: LearnerEducationMasterDataResponseDto;
  }> {
    return this.learnerService.updateEducationMasterDataById(id, payload);
  }

  @Get('learner-technical-skills')
  @ApiOperation({ summary: 'Get technical skills list' })
  async getTechnicalSkills(): Promise<{
    success: boolean;
    data: TechnicalSkillsResponseDto;
  }> {
    return this.learnerService.getTechnicalSkills();
  }

  @Post('learner-technical-skills')
  @ApiOperation({ summary: 'Create technical skills list' })
  @ApiBody({ type: UpsertTechnicalSkillsDto })
  async createTechnicalSkills(
    @Body() payload: UpsertTechnicalSkillsDto,
  ): Promise<{
    success: boolean;
    data: TechnicalSkillsResponseDto;
  }> {
    return this.learnerService.createTechnicalSkills(payload);
  }

  @Put('learner-technical-skills/:id')
  @ApiOperation({ summary: 'Update technical skill by id' })
  @ApiBody({ type: UpdateTechnicalSkillByIdDto })
  async updateTechnicalSkillById(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateTechnicalSkillByIdDto,
  ): Promise<{
    success: boolean;
    data: TechnicalSkillsResponseDto;
  }> {
    return this.learnerService.updateTechnicalSkillById(id, payload);
  }

  @Delete('learner-technical-skills/:id')
  @ApiOperation({ summary: 'Delete technical skill by id' })
  async deleteTechnicalSkillById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{
    success: boolean;
    data: TechnicalSkillsResponseDto;
  }> {
    return this.learnerService.deleteTechnicalSkillById(id);
  }

  @Get('learner-boards')
  @ApiOperation({ summary: 'Get learner boards list' })
  async getLearnerBoards(): Promise<{
    success: boolean;
    data: LearnerBoardsResponseDto;
  }> {
    return this.learnerService.getLearnerBoards();
  }

  @Post('learner-boards')
  @ApiOperation({ summary: 'Create learner boards list' })
  @ApiBody({ type: UpsertLearnerBoardsDto })
  async createLearnerBoards(@Body() payload: UpsertLearnerBoardsDto): Promise<{
    success: boolean;
    data: LearnerBoardsResponseDto;
  }> {
    return this.learnerService.createLearnerBoards(payload);
  }

  @Put('learner-boards/:id')
  @ApiOperation({ summary: 'Update learner board by id' })
  @ApiBody({ type: UpdateLearnerBoardByIdDto })
  async updateLearnerBoardById(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateLearnerBoardByIdDto,
  ): Promise<{
    success: boolean;
    data: LearnerBoardsResponseDto;
  }> {
    return this.learnerService.updateLearnerBoardById(id, payload);
  }

  @Delete('learner-boards/:id')
  @ApiOperation({ summary: 'Delete learner board by id' })
  async deleteLearnerBoardById(@Param('id', ParseIntPipe) id: number): Promise<{
    success: boolean;
    data: LearnerBoardsResponseDto;
  }> {
    return this.learnerService.deleteLearnerBoardById(id);
  }
}
