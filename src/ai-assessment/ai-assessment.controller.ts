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
} from '@nestjs/common';
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
  createAiAssessment,
  submitAssessmentExample,
} from './swagger_examples/examples';

@ApiTags('AI Assessment')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('ai-assessment')
export class AiAssessmentController {
  constructor(private readonly aiAssessmentService: AiAssessmentService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new AI assessment' })
  @ApiBody({
    type: CreateAiAssessmentDto,
    examples: {
      basicExample: {
        summary: 'Payload for creating ai assessment.',
        value: createAiAssessment,
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'AI assessment successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  create(@Body() createAiAssessmentDto: CreateAiAssessmentDto) {
    return this.aiAssessmentService.create(createAiAssessmentDto);
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
    const studentId = req.user[0]?.id;
    return this.aiAssessmentService.submitLlmAssessment(
      studentId,
      submitAssessmentDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get all AI assessments (optionally filter by bootcampId)',
  })
  @ApiQuery({ name: 'bootcampId', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of AI assessments.' })
  findAll(@Query('bootcampId') bootcampId?: number) {
    return this.aiAssessmentService.findAll(bootcampId);
  }
}
