import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AiAssessmentService } from './ai-assessment.service';
import {
  CreateAiAssessmentDto,
  SubmitAssessmentDto,
} from './dto/create-ai-assessment.dto';
import { UpdateAiAssessmentDto } from './dto/update-ai-assessment.dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('AI Assessment')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('ai-assessment')
export class AiAssessmentController {
  constructor(private readonly aiAssessmentService: AiAssessmentService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new AI assessment' })
  @ApiBody({ type: CreateAiAssessmentDto })
  @ApiResponse({
    status: 201,
    description: 'AI assessment successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  create(@Body() createAiAssessmentDto: CreateAiAssessmentDto) {
    return this.aiAssessmentService.create(createAiAssessmentDto);
  }

  @Post('/submit')
  @ApiOperation({ summary: 'Submit an AI assessment for evaluation' })
  @ApiBody({ type: SubmitAssessmentDto })
  @ApiResponse({
    status: 200,
    description: 'Assessment successfully submitted and evaluated.',
  })
  @ApiResponse({ status: 400, description: 'Invalid assessment data.' })
  takeAssessment(@Body() submitAssessmentDto: SubmitAssessmentDto, @Req() req) {
    const studentId = req.user[0]?.id;
    return this.aiAssessmentService.submitLlmAssessment(
      studentId,
      submitAssessmentDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all AI assessments' })
  @ApiResponse({ status: 200, description: 'List of all AI assessments.' })
  findAll() {
    return this.aiAssessmentService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific AI assessment' })
  @ApiParam({ name: 'id', description: 'Assessment ID', type: Number })
  @ApiResponse({ status: 200, description: 'Assessment details retrieved.' })
  @ApiResponse({ status: 404, description: 'Assessment not found.' })
  findOne(@Param('id') id: string) {
    return this.aiAssessmentService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a specific AI assessment' })
  @ApiParam({ name: 'id', description: 'Assessment ID', type: Number })
  @ApiBody({ type: UpdateAiAssessmentDto })
  @ApiResponse({ status: 200, description: 'Assessment updated successfully.' })
  @ApiResponse({ status: 404, description: 'Assessment not found.' })
  update(
    @Param('id') id: string,
    @Body() updateAiAssessmentDto: UpdateAiAssessmentDto,
  ) {
    return this.aiAssessmentService.update(+id, updateAiAssessmentDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a specific AI assessment' })
  @ApiParam({ name: 'id', description: 'Assessment ID', type: Number })
  @ApiResponse({ status: 200, description: 'Assessment deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Assessment not found.' })
  remove(@Param('id') id: string) {
    return this.aiAssessmentService.remove(+id);
  }
}
