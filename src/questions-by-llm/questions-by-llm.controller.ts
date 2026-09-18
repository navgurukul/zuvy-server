import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { QuestionsByLlmService } from './questions-by-llm.service';
import {
  CreateQuestionsByLlmDto,
  GenerateQuestionsDto,
} from './dto/create-questions-by-llm.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/rbac/guards/permissions.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { TrackAction } from 'src/trackinglog/decorators/track-action.decorator';

@ApiTags('questions-by-llm')
@Controller('questions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
export class QuestionsByLlmController {
  constructor(private readonly questionsByLlmService: QuestionsByLlmService) {}

  @Post(':orgId/generate')
  @ApiOperation({
    summary: 'Enqueue question generation jobs for an org-aware topic set',
  })
  @TrackAction({
    action: 'create_mcq',
    resourceType: 'mcq',
    permissionName: 'createMcq',
    displayType: 'a generated question set',
    getResourceName: (result, params) => {
      const topicConfigurations = params?.topicConfigurations;
      const firstTopic = Array.isArray(topicConfigurations)
        ? topicConfigurations[0]?.topicName ||
          topicConfigurations[0]?.topic ||
          'Question set'
        : 'Question set';
      return result?.data?.topicName || firstTopic;
    },
  })
  @ApiBody({
    type: GenerateQuestionsDto,
    examples: {
      restApis: {
        summary: 'REST APIs question generation sample',
        value: {
          topicName: 'REST APIs',
          topicDescription: 'Async and Await calls',
          subtopics: ['Async/Await', 'Error Handling'],
          numberOfQuestions: 5,
          learningObjectives: 'To understand asynchronous API calls',
          targetAudience: 'Beginner students',
          focusAreas: 'Focus on calling REST APIs',
          bloomsLevel: 'apply',
          questionStyle: 'practical',
          difficultyDistribution: { easy: 11, medium: 44, hard: 45 },
          questionCounts: { easy: 1, medium: 2, hard: 2 },
          topics: { node: 5 },
          topicConfigurations: [
            {
              topicName: 'REST APIs',
              topicDescription: 'Async and Await calls',
              subtopics: ['Async/Await', 'Error Handling'],
              totalQuestions: 5,
              questionCounts: { easy: 1, medium: 2, hard: 2 },
            },
          ],
          levelId: null,
        },
      },
    },
  })
  @ApiParam({
    name: 'orgId',
    type: Number,
    description: 'Organization that owns the generated questions',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Question generation jobs enqueued. You are not blocked.',
  })
  generateQuestions(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Body() payload: GenerateQuestionsDto,
    @Req() req,
  ) {
    const userId = req.user?.[0]?.id ?? req.user?.id;
    return this.questionsByLlmService.generateQuestions(payload, orgId, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a QuestionsByLlm entry' })
  @ApiBody({ type: CreateQuestionsByLlmDto })
  @ApiResponse({
    status: 201,
    description: 'Created successfully',
    type: CreateQuestionsByLlmDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  create(@Body() createQuestionsByLlmDto: CreateQuestionsByLlmDto) {
    return this.questionsByLlmService.create(createQuestionsByLlmDto, 1);
  }

  @Get()
  @ApiOperation({ summary: 'Get all QuestionsByLlm entries' })
  @ApiQuery({
    name: 'aiAssessmentId',
    required: true,
    type: String,
    description: 'Search by ai assessment id',
  })
  @ApiResponse({
    status: 200,
    description: 'List retrieved',
    type: [CreateQuestionsByLlmDto],
  })
  findAll(@Query('aiAssessmentId') id: number) {
    return this.questionsByLlmService.getAllLlmQuestions(id);
  }

  // @Get(':id')
  // // @ApiOperation({ summary: 'Get one QuestionsByLlm entry by id' })
  // // @ApiParam({
  // //   name: 'id',
  // //   type: 'number',
  // //   description: 'Numeric id of the entry',
  // // })
  // // @ApiResponse({
  // //   status: 200,
  // //   description: 'Entry retrieved',
  // //   type: CreateQuestionsByLlmDto,
  // // })
  // // @ApiResponse({ status: 404, description: 'Not found' })
  // findOne(@Param('id', ParseIntPipe) id: number) {
  //   return this.questionsByLlmService.findOne(id);
  // }

  // @Patch(':id')
  // // @ApiOperation({ summary: 'Update a QuestionsByLlm entry' })
  // // @ApiParam({
  // //   name: 'id',
  // //   type: 'number',
  // //   description: 'Numeric id of the entry',
  // // })
  // // @ApiBody({ type: UpdateQuestionsByLlmDto })
  // // @ApiResponse({
  // //   status: 200,
  // //   description: 'Updated successfully',
  // //   type: UpdateQuestionsByLlmDto,
  // // })
  // // @ApiResponse({ status: 400, description: 'Invalid payload' })
  // // @ApiResponse({ status: 404, description: 'Not found' })
  // update(
  //   @Param('id', ParseIntPipe) id: number,
  //   @Body() updateQuestionsByLlmDto: UpdateQuestionsByLlmDto,
  // ) {
  //   return this.questionsByLlmService.update(id, updateQuestionsByLlmDto);
  // }

  // @Delete(':id')
  // // @ApiOperation({ summary: 'Remove a QuestionsByLlm entry' })
  // // @ApiParam({
  // //   name: 'id',
  // //   type: 'number',
  // //   description: 'Numeric id of the entry',
  // // })
  // // @ApiResponse({ status: 200, description: 'Deleted successfully' })
  // // @ApiResponse({ status: 404, description: 'Not found' })
  // remove(@Param('id', ParseIntPipe) id: number) {
  //   return this.questionsByLlmService.remove(id);
  // }
}
