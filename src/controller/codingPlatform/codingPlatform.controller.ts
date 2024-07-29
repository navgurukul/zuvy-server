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


  // @Get('languageId')
  // @ApiOperation({ summary: 'Get language with Id' })
  // @ApiBearerAuth()
  // async getLanguages() {
  //   const res = await this.codingPlatformService.getLanguagesById();
  //   return res;
  // }


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

  // @Post('createCodingQuestion')
  // @ApiOperation({ summary: 'Create coding question' })
  // @ApiBearerAuth()
  // async createCodingProblems(@Body() createCodingQuestion: CreateProblemDto) {
  //   let examples = [];
  //   let testCases = [];
  //   for (let i = 0; i < createCodingQuestion.examples.length; i++) {
  //     examples.push(createCodingQuestion.examples[i].inputs);
  //   }
  //   createCodingQuestion.examples = examples;
  //   for (let j = 0; j < createCodingQuestion.testCases.length; j++) {
  //     testCases.push(createCodingQuestion.testCases[j].inputs)
  //   }
  //   createCodingQuestion.testCases = testCases
  //   const res = await this.codingPlatformService.createCodingProblem(createCodingQuestion);
  //   return res;
  // }

  @Post('/practicecode/questionId=:questionId')
  @ApiOperation({ summary: 'Submiting the coding question' })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'submissionId',
    required: false,
    type: Number,
    description: 'if you give the submissionId it for assessment code submission',
  })
  @ApiQuery({
    name: 'codingOutsourseId',
    required: false,
    type: Number,
    description: 'if you give the codingOutsourseId it for assessment code submission',
  })
  async getPracticeCode(@Param('questionId') questionId: number, 
    @Body() sourceCode: SubmitCodeDto,
    @Query('action') action: string,
    @Query('submissionId') submissionId: number,
    @Query('codingOutsourseId') codingOutsourseId: number,
    @Req() req,
  ) {
    if (Number.isNaN(submissionId) && !Number.isNaN(codingOutsourseId) || !Number.isNaN(submissionId) && Number.isNaN(codingOutsourseId)){
      return {statusCode: 404, massage: "Either submissionId or codingOutsourseId should be provided"}
    }

      return this.codingPlatformService.submitPracticeCode(questionId, sourceCode, action, req.user[0].id, submissionId, codingOutsourseId);
  }

  @Get('/practicecode/questionId=:questionId')
  @ApiOperation({ summary: 'Get the question AND submissions by question id ' })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'assessmentSubmissionId', 
    required: false,
    type: Number,
    description: 'if you give the assessmentSubmissionId it for assessment code submission ',
  })
  @ApiQuery({
    name: 'codingOutsourseId', 
    required: false,
    type: Number,
    description: 'if you give the codingOutsourseId it for assessment code submission ',
  })
  async getPracticeCodeById(@Param('questionId') questionId: number, @Req() req, @Query('assessmentSubmissionId') submissionId: number, @Query('codingOutsourseId') codingOutsourseId:number){
    return this.codingPlatformService.getPracticeCode(questionId, req.user[0].id, submissionId, codingOutsourseId);
  }
  @Get('PracticeCode')
  @ApiOperation({ summary: 'Get the codingOutsourse by userId and codingOutsourseId' })
  @ApiBearerAuth()
  async codingSubmission(@Req() req, @Query('studentId') studentId: number, @Query('codingOutsourseId') codingOutsourseId: number) {
    return this.codingPlatformService.codingSubmission(studentId, codingOutsourseId);
  }

  @Get(':languageId')
  @ApiOperation({ summary: 'Get language with Id' })
  @ApiBearerAuth()
  async getLanguages(@Param('languageId') languageId: string) {
    const res = await this.codingPlatformService.getLanguagesById(languageId);
    return res;
  }

  @Post('create-question')
  @ApiOperation({ summary: 'Create coding question with test cases' })
  @ApiBearerAuth()
  async createCodingQuestion(@Body() createCodingQuestionDto: CreateProblemDto) {
    const res = await this.codingPlatformService.createCodingQuestion(createCodingQuestionDto);
    return res;
  }

  @Put('update-question/:id')
  @ApiOperation({ summary: 'Update coding question' })
  @ApiBearerAuth()
  async updateCodingQuestion(@Param('id') id: number, @Body() updateCodingQuestionDto: CreateProblemDto) {
    const res = await this.codingPlatformService.updateCodingQuestion(id, updateCodingQuestionDto);
    return res;
  }

  @Delete('delete-question/:id')
  @ApiOperation({ summary: 'Delete coding question' })
  @ApiBearerAuth()
  async deleteCodingQuestion(@Param('id') id: number) {
    const res = await this.codingPlatformService.deleteCodingQuestion(id);
    return res;
  }

  // get coding question by id
  @Get('get-coding-question')
  @ApiOperation({ summary: 'Get coding question' })
  @ApiBearerAuth()
  async getCodingQuestion(@Query('id') id: number) {
    const res = await this.codingPlatformService.getCodingQuestion(id);
    return res;
  }

  // @Post('create-language')
  // @ApiOperation({ summary: 'Create a new language' })
  // @ApiBearerAuth()
  // async createLanguage(@Body() createLanguageDto: CreateLanguageDto) {
  //   const res = await this.codingPlatformService.createLanguage(createLanguageDto);
  //   return res;
  // }
}
