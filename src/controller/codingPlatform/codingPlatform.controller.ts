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

  // @Post('submit')
  // @ApiOperation({ summary: 'Run the code' })
  // @ApiQuery({
  //   name: 'codingOutsourseId',
  //   required: false,
  //   type: Number,
  //   description: 'Question id of the question attempted',
  // })
  // @ApiQuery({
  //   name: 'action',
  //   required: true,
  //   type: String,
  //   description: 'Action such as submit or run',
  // })
  // @ApiQuery({
  //   name: 'assessmentSubmissionId',
  //   required: false,
  //   type: Number,
  //   description: 'Assessment submission id',
  // })
  // @ApiBearerAuth()
  // async submitCode(
  //   @Body() sourceCode: SubmitCodeDto,
  //   @Query('codingOutsourseId') codingOutsourseId: number,
  //   @Query('action') action: string,
  //   @Query('assessmentSubmissionId') assessmentSubmissionId: number,
  //   @Req() req,
  // ) {
  //   const res = await this.codingPlatformService.submitCode(
  //     sourceCode,
  //     codingOutsourseId,
  //     action,
  //     );
  //   let statusId = 1;
  //   let getCodeData;
  //   while (statusId < 3) {
  //     getCodeData = await this.codingPlatformService.getCodeInfo(res.token);
  //     statusId = getCodeData.status_id;
  //   }
  //   if (action == 'submit') {
  //     await this.codingPlatformService.updateSubmissionWithToken(
  //       req.user[0].id,
  //       codingOutsourseId,
  //       getCodeData.token,
  //       getCodeData.status.description,
  //       assessmentSubmissionId
  //     );
  //   }
  //   return getCodeData;
  // }

  @Get('languageId')
  @ApiOperation({ summary: 'Get language with Id' })
  @ApiBearerAuth()
  async getLanguages() {
    const res = await this.codingPlatformService.getLanguagesById();
    return res;
  }

  // @Get('allSubmissionsByQuestionId/:questionId')
  // @ApiOperation({ summary: 'Get all submission by question id' })
  // @ApiQuery({
  //   name: 'userId',
  //   required: false,
  //   type: Number,
  //   description: 'User id of the user',
  // })
  // @ApiBearerAuth()
  // async getAllSubmissionByQuestionId(
  //   @Param('questionId') question_id: number,
  //   @Query('userId') userId: number,
  // ) {
  //   const res = await this.codingPlatformService.findSubmissionByQuestionId(
  //     question_id,
  //     userId,
  //   );
  //   return res;
  // }


   // page=1&limit=10
  @Get('allQuestions')
  @ApiOperation({ summary: 'Get all the questions with status.' })
  @ApiQuery({
    name: 'difficulty',
    required: false,
    type: String,
    description: 'difficulty of the question',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'limit',
  })
  @ApiBearerAuth()
  async getAllQuestionByUserId(@Req() req, @Query('difficulty') difficulty: string, @Query('page') page: number, @Query('limit') limit: number) {
    const res = await this.codingPlatformService.getQuestionsWithStatus(req.user[0].id, difficulty, page, limit);
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

  @Post('/practicecode/questionId=:questionId')
  @ApiOperation({ summary: 'Submiting the coding question' })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'codingOutsourseId',
    required: false,
    type: Number,
    description: 'if you give the codingOutsourseId it for assessment code submission',
  })
  async getPracticeCode(@Param('questionId') questionId: number, 
    @Body() sourceCode: SubmitCodeDto,
    @Query('action') action: string,
    @Query('codingOutsourseId') codingOutsourseId: number,
    @Req() req,
  ) {
    return this.codingPlatformService.submitPracticeCode(questionId, sourceCode, action, req.user[0].id, codingOutsourseId);
  }

  @Get('/practicecode/questionId=:questionId')
  @ApiOperation({ summary: 'Get the question AND submissions by question id ' })
  @ApiBearerAuth()
  async getPracticeCodeById(@Param('questionId') questionId: number, @Req() req){
    return this.codingPlatformService.getPracticeCode(questionId, req.user[0].id);
  }
}
