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
  Query,
  HttpCode,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { AiAssessmentService } from './ai-assessment.service';
import {
  CreateAiAssessmentDto,
  GenerateAssessmentDto,
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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import {
  createAiAssessmentBootcamp,
  submitAssessmentExample,
} from './swagger_examples/examples';
import { AiAssessmentCrudService } from './ai-assessment.crud.service';
import { AiAssessmentMappingService } from './ai-assessment.mapping.service';
import { resolveOrgId } from 'src/auth/resolve-org-id';

@ApiTags('AI Assessment')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('ai-assessment')
export class AiAssessmentController {
  constructor(
    private readonly aiAssessmentService: AiAssessmentService,
    private readonly aiAssessmentCrudService: AiAssessmentCrudService,
    private readonly aiAssessmentMappingService: AiAssessmentMappingService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new AI assessment' })
  @ApiBody({
    type: CreateAiAssessmentDto,
    examples: {
      basicExample: {
        summary: 'Create assessment with poolTopics and moduleId',
        value: createAiAssessmentBootcamp,
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'AI assessment successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  create(@Body() createAiAssessmentDto: CreateAiAssessmentDto, @Req() req) {
    const userId = req.user?.sub;
    return this.aiAssessmentCrudService.create(userId, createAiAssessmentDto);
  }

  @Post('/generate/all')
  @ApiOperation({ summary: 'Generate mcqs' })
  @ApiBody({
    type: Object,
    examples: {
      basicExample: {
        summary: 'Generate Mcqs.',
        value: { aiAssessmentId: 800 },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Assessment successfully submitted and evaluated.',
  })
  @ApiResponse({ status: 400, description: 'Invalid assessment data.' })
  generate(@Body() generateAssessmentDto: GenerateAssessmentDto, @Req() req) {
    const userId = req.user[0]?.id;
    return this.aiAssessmentService.generate(userId, generateAssessmentDto);
  }

  @Post('/submit')
  @ApiOperation({ summary: 'Submit an AI assessment for evaluation' })
  @ApiBody({
    type: SubmitAssessmentDto,
    examples: {
      basicExample: {
        summary: 'Example submission with basic coding questions',
        value: submitAssessmentExample,
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Assessment successfully submitted and evaluated.',
  })
  @ApiResponse({ status: 400, description: 'Invalid assessment data.' })
  takeAssessment(@Body() submitAssessmentDto: SubmitAssessmentDto, @Req() req) {
    try {
      const studentId = req.user[0]?.id;
      return this.aiAssessmentService.submitLlmAssessment(
        studentId,
        submitAssessmentDto,
      );
    } catch (error) {
      console.error('error in evaluation controller', error);
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Get all AI assessments (optionally filter by bootcampId)',
  })
  @ApiQuery({ name: 'bootcampId', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of AI assessments.' })
  findAll(@Req() req, @Query('bootcampId') bootcampId?: number) {
    const userId = req.user[0]?.id;
    return this.aiAssessmentService.findAll(userId, bootcampId);
  }

  @Get('/by/studentId')
  @ApiOperation({
    summary: 'Get all AI assessments by student id',
  })
  @ApiResponse({
    status: 200,
    description: 'List of AI assessments of a student.',
  })
  @ApiQuery({ name: 'bootcampId', required: false, type: Number })
  findAllAssessmentOfAStudent(
    @Query('bootcampId') bootcampId: number,
    @Req() req,
  ) {
    const userId = req.user[0]?.id;
    return this.aiAssessmentService.findAllAssessmentOfAStudent(
      userId,
      bootcampId,
    );
  }

  @Get(':id/question-sets')
  @ApiOperation({
    summary:
      'Instructor preview: all generated question sets with full MCQs (includes correct answers). Use after map-questions.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({
    name: 'setId',
    required: false,
    type: Number,
    description: 'Filter by question-set ID',
  })
  @ApiQuery({
    name: 'setIndex',
    required: false,
    type: Number,
    description: 'Filter by set index',
  })
  @ApiQuery({
    name: 'levelCode',
    required: false,
    type: String,
    example: 'E',
    description: 'Filter by set level code',
  })
  @ApiQuery({
    name: 'topicName',
    required: false,
    type: String,
    description: 'Filter questions by topic name',
  })
  @ApiQuery({
    name: 'difficulty',
    required: false,
    type: String,
    example: 'easy',
    description: 'Filter questions by difficulty',
  })
  @ApiQuery({
    name: 'questionId',
    required: false,
    type: Number,
    description: 'Filter by question ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Question sets and questions for the assessment.',
  })
  @ApiResponse({ status: 404, description: 'Assessment not found.' })
  async getQuestionSetsForInstructor(
    @Param('id') id: string,
    @Query('setId') setId?: string,
    @Query('setIndex') setIndex?: string,
    @Query('levelCode') levelCode?: string,
    @Query('topicName') topicName?: string,
    @Query('difficulty') difficulty?: string,
    @Query('questionId') questionId?: string,
  ) {
    const aiAssessmentId = Number(id);
    if (Number.isNaN(aiAssessmentId)) {
      throw new HttpException('Invalid assessment id', HttpStatus.BAD_REQUEST);
    }
    return this.aiAssessmentMappingService.getInstructorQuestionSetsPreview(
      aiAssessmentId,
      {
        setId: setId ? Number(setId) : undefined,
        setIndex: setIndex ? Number(setIndex) : undefined,
        levelCode,
        topicName,
        difficulty,
        questionId: questionId ? Number(questionId) : undefined,
      },
    );
  }

  @Post(':id/map-questions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Map (generate) question sets for an assessment (path-param variant, kept for backward compatibility)',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({
    name: 'orgId',
    required: false,
    type: Number,
    description:
      'Required for super admin (no orgId in token). Other roles use orgId from the JWT.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Question sets generated and mapped successfully for the given assessment.',
  })
  async mapQuestions(
    @Param('id') id: string,
    @Req() req: Request & { user?: { orgId?: number | string } },
  ) {
    const aiAssessmentId = Number(id);
    if (Number.isNaN(aiAssessmentId)) {
      throw new HttpException('Invalid assessment id', HttpStatus.BAD_REQUEST);
    }
    return this.aiAssessmentMappingService.mapQuestionsForAssessment(
      aiAssessmentId,
      {
        orgId: resolveOrgId(req),
        authorization: req.headers?.authorization,
      },
    );
  }
}
