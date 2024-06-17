import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ValidationPipe,
  UsePipes,
  Optional,
  Query,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { CodingPlatformService } from './codingPlatform.service';
import {
  ApiTags,
  ApiBody,
  ApiOperation,
  ApiCookieAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SubmitCodeDto, CreateProblemDto } from './dto/codingPlatform.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
@Controller('codingPlatform')
@ApiTags('codingPlatform')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
export class CodingPlatformController {
  constructor(private codingPlatformService: CodingPlatformService) { }
  @Post('submit')
  @ApiOperation({ summary: 'Run the code' })
  @ApiQuery({
    name: 'questionId',
    required: false,
    type: Number,
    description: 'Question id of the question attempted',
  })
  @ApiQuery({
    name: 'action',
    required: true,
    type: String,
    description: 'Action such as submit or run',
  })
  @ApiQuery({
    name: 'assessmentSubmissionId',
    required: false,
    type: Number,
    description: 'Assessment submission id',
  })
  @ApiBearerAuth()
  async submitCode(
    @Body() sourceCode: SubmitCodeDto,
    @Query('questionId') questionId: number,
    @Query('action') action: string,
    @Query('assessmentSubmissionId') assessmentSubmissionId: number,
    @Req() req,
  ) {
    const res = await this.codingPlatformService.submitCode(
      sourceCode,
      questionId,
      action,
      );
    let statusId = 1;
    let getCodeData;
    while (statusId < 3) {
      getCodeData = await this.codingPlatformService.getCodeInfo(res.token);
      statusId = getCodeData.status_id;
    }
    if (action == 'submit') {
      await this.codingPlatformService.updateSubmissionWithToken(
        req.user[0].id,
        questionId,
        getCodeData.token,
        getCodeData.status.description,
        assessmentSubmissionId
      );
    }
    return getCodeData;
  }

  @Get('languageId')
  @ApiOperation({ summary: 'Get language with Id' })
  @ApiBearerAuth()
  async getLanguages() {
    const res = await this.codingPlatformService.getLanguagesById();
    return res;
  }

  @Get('allSubmissionsByQuestionId/:questionId')
  @ApiOperation({ summary: 'Get all submission by question id' })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: Number,
    description: 'User id of the user',
  })
  @ApiBearerAuth()
  async getAllSubmissionByQuestionId(
    @Param('questionId') question_id: number,
    @Query('userId') userId: number,
  ) {
    const res = await this.codingPlatformService.findSubmissionByQuestionId(
      question_id,
      userId,
    );
    return res;
  }

  @Get('allQuestions/:userId')
  @ApiOperation({ summary: 'Get all the questions with status' })
  @ApiBearerAuth()
  async getAllQuestionByUserId(@Param('userId') userId: number) {
    const res = await this.codingPlatformService.getQuestionsWithStatus(userId);
    return res;
  }

  @Get('questionById/:questionId')
  @ApiOperation({ summary: 'Get the questions by Id' })
  @ApiBearerAuth()
  async getQuestionById(@Param('questionId') questionId: number) {
    const res = await this.codingPlatformService.getQuestionById(questionId);
    return res;
  }

  @Post('createCodingQuestion')
  @ApiOperation({ summary: 'Create coding question' })
  @ApiBearerAuth()
  async createCodingProblems(@Body() createCodingQuestion: CreateProblemDto) {
    let examples = [];
    let testCases = [];
    for (let i = 0; i < createCodingQuestion.examples.length; i++) {
      examples.push(createCodingQuestion.examples[i].inputs);
    }
    createCodingQuestion.examples = examples;
    for (let j = 0; j < createCodingQuestion.testCases.length; j++) {
      testCases.push(createCodingQuestion.testCases[j].inputs)
    }
    createCodingQuestion.testCases = testCases
    const res = await this.codingPlatformService.createCodingProblem(createCodingQuestion);
    return res;
  }
}
