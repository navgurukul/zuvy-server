import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { QuestionsByLlmService } from './questions-by-llm.service';
import { CreateQuestionsByLlmDto } from './dto/create-questions-by-llm.dto';
import { UpdateQuestionsByLlmDto } from './dto/update-questions-by-llm.dto';
import { QuestionEvaluationService } from './question-evaluation.service';

@ApiTags('questions-by-llm')
@Controller('questions-by-llm/evaluation')
export class QuestionsEvaluationController {
  constructor(
    private readonly questionsByLlmService: QuestionsByLlmService,
    private readonly questionEvaluationsService: QuestionEvaluationService,
  ) {}

  //   @Get()
  //   @ApiOperation({ summary: 'Get all QuestionsByLlm evaluations' })
  //   @ApiResponse({
  //     status: 200,
  //     description: 'List retrieved',
  //     type: [CreateQuestionsByLlmDto],
  //   })
  //   findAll() {
  //     return this.questionsByLlmService.getAllLlmQuestions();
  //   }

  @Get(':studentId')
  @ApiOperation({ summary: 'Get one evaluation entry by studentId' })
  @ApiParam({
    name: 'studentId',
    type: 'number',
    description: 'Numeric id of the entry',
  })
  @ApiResponse({
    status: 200,
    description: 'Entry retrieved',
    type: CreateQuestionsByLlmDto,
  })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.questionEvaluationsService.findOneByStudentId(studentId);
  }
}
