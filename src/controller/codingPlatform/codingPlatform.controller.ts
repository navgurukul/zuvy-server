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
  ApiQuery,
} from '@nestjs/swagger';
import { SubmitCodeDto, CreateProblemDto, updateProblemDto, TestCaseDto} from './dto/codingPlatform.dto';
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
  //   return this.codingPlatformService.getLanguagesById();
  //
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
    return this.codingPlatformService.getQuestionsWithStatus(req.user[0].id, difficulty, page, limit);
  }


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
  async getLanguages(@Param('languageId') languageId: number) {
    return this.codingPlatformService.getLanguagesById(languageId);
  }

  @Post('create-question')
  @ApiOperation({ summary: 'Create coding question with test cases' })
  @ApiBearerAuth()
  async createCodingQuestion(@Body() createCodingQuestionDto: CreateProblemDto) : Promise<any>{
    let [err, data] = await this.codingPlatformService.createCodingQuestion(createCodingQuestionDto);
    if (err) {
      throw new BadRequestException(err);
    }
    return data;
  }

  @Put('update-question/:id')
  @ApiOperation({ summary: 'Update coding question' })
  @ApiBearerAuth()
  async updateCodingQuestion(@Param('id') id: number, @Body() updateCodingQuestionDto: updateProblemDto) {
    let [err, data] = await  this.codingPlatformService.updateCodingQuestion(id, updateCodingQuestionDto);
    if (err) {
      throw new BadRequestException(err);
    }
    return data;
  }

  @Delete('delete-question/:id')
  @ApiOperation({ summary: 'Delete coding question' })
  @ApiBearerAuth()
  async deleteCodingQuestion(@Param('id') id: number): Promise<any> {
    let [err, data] = await  this.codingPlatformService.deleteCodingQuestion(id);
    if (err) {
      throw new BadRequestException(err);
    }
    return data;
  }

  @Delete('delete-testcase/:id')
  @ApiOperation({ summary: 'Delete coding Testcase' })
  @ApiBearerAuth()
  async deleteCodingTestcase(@Param('id') id: number): Promise<any> {
    let [err, data] = await  this.codingPlatformService.deleteCodingTestcase(id);
    if (err) {
      throw new BadRequestException(err);
    }
    return data;
  }

  // get coding question by id
  @Get('get-coding-question/:id')
  @ApiOperation({ summary: 'Get coding question' })
  @ApiBearerAuth()
  async getCodingQuestion(@Param('id') Id: number): Promise<any> {
    let [err, data] = await this.codingPlatformService.getCodingQuestion(Id);
    if (err) {
      throw new BadRequestException(err);
    }
    return data;
  }

  // adding the test case by question id
  @Post('add-test-case/:question_id')
  @ApiOperation({ summary: 'Add test case to coding question' })
  @ApiBearerAuth()
  async addTestCase(@Param('question_id') question_id: number, @Body() updateTestCaseDto: TestCaseDto): Promise<any> {
    let [err, data] = await  this.codingPlatformService.addTestCase(question_id, updateTestCaseDto);
    if (err) {
      throw new BadRequestException(err);
    }
    return data;
  }

}
