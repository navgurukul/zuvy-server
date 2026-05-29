import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
  // ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { LearnerService } from './learner.service';
import {
  LearnerBoardsResponseDto,
  LearnerEducationBranchesResponseDto,
  LearnerDegreesResponseDto,
  LearnerDegreesWithBranchesResponseDto,
  BranchesForDegreeResponseDto,
  LearnerRemoteLocationsResponseDto,
  LearnerRolesResponseDto,
  TechnicalSkillsResponseDto,
  UpdateLearnerBoardByIdDto,
  UpdateLearnerEducationBranchByIdDto,
  UpdateLearnerDegreeByIdDto,
  UpdateLearnerRemoteLocationByIdDto,
  UpdateLearnerRoleByIdDto,
  UpdateTechnicalSkillByIdDto,
  UpsertLearnerBoardsDto,
  UpsertLearnerEducationBranchesDto,
  UpsertLearnerDegreesDto,
  UpsertLearnerRemoteLocationsDto,
  UpsertLearnerRolesDto,
  UpsertTechnicalSkillsDto,
} from './dto/learner.dto';
import { SkipOrgCheck } from 'src/rbac/decorators/skip-org-check.decorator';
@ApiTags('Learner Information')
@SkipOrgCheck()
@Controller('basic')
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

  @Get('colleges-name')
  @ApiOperation({ summary: 'Search colleges by name' })
  @ApiQuery({
    name: 'name',
    required: true,
    type: String,
    description: 'College name search term',
  })
  async searchColleges(@Query('name') name: string): Promise<{
    success: boolean;
    data: Record<string, unknown>[];
  }> {
    return this.learnerService.searchColleges(name);
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

  @Get('learner-degree-details')
  @ApiOperation({ summary: 'Get learner degree list' })
  async getLearnerDegrees(): Promise<{
    success: boolean;
    data: LearnerDegreesResponseDto;
  }> {
    return this.learnerService.getLearnerDegrees();
  }

  @Get('learner-degree-details-with-branches')
  @ApiOperation({
    summary: 'Get learner degree list with branches for dependent dropdown',
  })
  @ApiQuery({
    name: 'degreeId',
    required: false,
    type: Number,
    description:
      'Optional degree ID to fetch branches for specific degree. If provided, returns branches for that degree. If not provided, returns all degrees with their branches.',
  })
  async getLearnerDegreesWithBranches(
    @Query('degreeId') degreeId?: string,
  ): Promise<{
    success: boolean;
    data: LearnerDegreesWithBranchesResponseDto | BranchesForDegreeResponseDto;
  }> {
    const parsedDegreeId = degreeId ? parseInt(degreeId, 10) : undefined;

    if (degreeId && Number.isNaN(parsedDegreeId)) {
      throw new BadRequestException('degreeId must be a valid number');
    }

    if (parsedDegreeId !== undefined) {
      return this.learnerService.getLearnerBranchesForDegree(parsedDegreeId);
    }

    return this.learnerService.getLearnerDegreesWithBranches();
  }

  @Post('learner-degree-details')
  @ApiOperation({ summary: 'Create learner degree list' })
  @ApiBody({ type: UpsertLearnerDegreesDto })
  async createLearnerDegrees(
    @Body() payload: UpsertLearnerDegreesDto,
  ): Promise<{
    success: boolean;
    data: LearnerDegreesResponseDto;
  }> {
    return this.learnerService.createLearnerDegrees(payload);
  }

  @Put('learner-degree-details/:id')
  @ApiOperation({ summary: 'Update learner degree by id' })
  @ApiBody({ type: UpdateLearnerDegreeByIdDto })
  async updateLearnerDegreeById(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateLearnerDegreeByIdDto,
  ): Promise<{
    success: boolean;
    data: LearnerDegreesResponseDto;
  }> {
    return this.learnerService.updateLearnerDegreeById(id, payload);
  }

  @Delete('learner-degree-details/:id')
  @ApiOperation({ summary: 'Delete learner degree by id' })
  async deleteLearnerDegreeById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{
    success: boolean;
    data: LearnerDegreesResponseDto;
  }> {
    return this.learnerService.deleteLearnerDegreeById(id);
  }

  @Get('learner-education-branch-details')
  @ApiOperation({ summary: 'Get learner education branch list' })
  @ApiQuery({
    name: 'degreeId',
    required: false,
    type: Number,
    description: 'Optional degree ID to filter branches',
  })
  async getLearnerEducationBranches(
    @Query('degreeId') degreeId?: string,
  ): Promise<{
    success: boolean;
    data: LearnerEducationBranchesResponseDto;
  }> {
    const parsedDegreeId = degreeId ? parseInt(degreeId, 10) : undefined;
    return this.learnerService.getLearnerEducationBranches(parsedDegreeId);
  }

  @Post('learner-education-branch-details')
  @ApiOperation({ summary: 'Create learner education branch list' })
  @ApiBody({ type: UpsertLearnerEducationBranchesDto })
  async createLearnerEducationBranches(
    @Body() payload: UpsertLearnerEducationBranchesDto,
  ): Promise<{
    success: boolean;
    data: LearnerEducationBranchesResponseDto;
  }> {
    return this.learnerService.createLearnerEducationBranches(payload);
  }

  @Put('learner-education-branch-details/:id')
  @ApiOperation({ summary: 'Update learner education branch by id' })
  @ApiBody({ type: UpdateLearnerEducationBranchByIdDto })
  async updateLearnerEducationBranchById(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateLearnerEducationBranchByIdDto,
  ): Promise<{
    success: boolean;
    data: LearnerEducationBranchesResponseDto;
  }> {
    return this.learnerService.updateLearnerEducationBranchById(id, payload);
  }

  @Delete('learner-education-branch-details/:id')
  @ApiOperation({ summary: 'Delete learner education branch by id' })
  async deleteLearnerEducationBranchById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{
    success: boolean;
    data: LearnerEducationBranchesResponseDto;
  }> {
    return this.learnerService.deleteLearnerEducationBranchById(id);
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

  @Get('learner-roles')
  @ApiOperation({ summary: 'Get learner roles list' })
  async getLearnerRoles(): Promise<{
    success: boolean;
    data: LearnerRolesResponseDto;
  }> {
    return this.learnerService.getLearnerRoles();
  }

  @Post('learner-roles')
  @ApiOperation({ summary: 'Create learner roles list' })
  @ApiBody({ type: UpsertLearnerRolesDto })
  async createLearnerRoles(@Body() payload: UpsertLearnerRolesDto): Promise<{
    success: boolean;
    data: LearnerRolesResponseDto;
  }> {
    return this.learnerService.createLearnerRoles(payload);
  }

  @Put('learner-roles/:id')
  @ApiOperation({ summary: 'Update learner role by id' })
  @ApiBody({ type: UpdateLearnerRoleByIdDto })
  async updateLearnerRoleById(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateLearnerRoleByIdDto,
  ): Promise<{
    success: boolean;
    data: LearnerRolesResponseDto;
  }> {
    return this.learnerService.updateLearnerRoleById(id, payload);
  }

  @Delete('learner-roles/:id')
  @ApiOperation({ summary: 'Delete learner role by id' })
  async deleteLearnerRoleById(@Param('id', ParseIntPipe) id: number): Promise<{
    success: boolean;
    data: LearnerRolesResponseDto;
  }> {
    return this.learnerService.deleteLearnerRoleById(id);
  }

  @Get('learner-remote-locations')
  @ApiOperation({ summary: 'Get learner remote locations list' })
  async getLearnerRemoteLocations(): Promise<{
    success: boolean;
    data: LearnerRemoteLocationsResponseDto;
  }> {
    return this.learnerService.getLearnerRemoteLocations();
  }

  @Post('learner-remote-locations')
  @ApiOperation({ summary: 'Create learner remote locations list' })
  @ApiBody({ type: UpsertLearnerRemoteLocationsDto })
  async createLearnerRemoteLocations(
    @Body() payload: UpsertLearnerRemoteLocationsDto,
  ): Promise<{
    success: boolean;
    data: LearnerRemoteLocationsResponseDto;
  }> {
    return this.learnerService.createLearnerRemoteLocations(payload);
  }

  @Put('learner-remote-locations/:id')
  @ApiOperation({ summary: 'Update learner remote location by id' })
  @ApiBody({ type: UpdateLearnerRemoteLocationByIdDto })
  async updateLearnerRemoteLocationById(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateLearnerRemoteLocationByIdDto,
  ): Promise<{
    success: boolean;
    data: LearnerRemoteLocationsResponseDto;
  }> {
    return this.learnerService.updateLearnerRemoteLocationById(id, payload);
  }

  @Delete('learner-remote-locations/:id')
  @ApiOperation({ summary: 'Delete learner remote location by id' })
  async deleteLearnerRemoteLocationById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{
    success: boolean;
    data: LearnerRemoteLocationsResponseDto;
  }> {
    return this.learnerService.deleteLearnerRemoteLocationById(id);
  }
}
