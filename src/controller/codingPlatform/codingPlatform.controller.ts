import { Controller, Get, Post, Put, Patch, Delete, Body, Param, ValidationPipe, UsePipes, Optional, Query, BadRequestException, Req } from '@nestjs/common';
import { CodingPlatformService } from './codingPlatform.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { SubmitCodeDto } from './dto/codingPlatform.dto';
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
    name: 'userId',
    required: false,
    type: Number,
    description: 'User id of the user',
  })
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
    description: 'Action such as submit or run'
  })
  @ApiBearerAuth()
  async submitCode(@Body() sourceCode: SubmitCodeDto,
    @Query('userId') userId: number,
    @Query('questionId') questionId: number,
    @Query('action') action: string
  ) {
    let statusId = 1;
    let getCodeData;
    const res =
      await this.codingPlatformService.submitCode(sourceCode, questionId, action);
    while (statusId < 3) {
      getCodeData = await this.codingPlatformService.getCodeInfo(res.token);
      statusId = getCodeData.status_id;
    }
    if (action == 'submit') {
      await this.codingPlatformService.updateSubmissionWithToken(userId, questionId, getCodeData.token, getCodeData.status.description)
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
    const res = await this.codingPlatformService.findSubmissionByQuestionId(question_id, userId);
    return res;
  }

  @Get('allQuestions/:userId')
  @ApiOperation({ summary: 'Get all the questions with status' })
  @ApiBearerAuth()
  async getAllQuestionByUserId(
    @Param('userId') userId: number
  ) {
    const res = await this.codingPlatformService.getQuestionsWithStatus(userId);
    return res;
  }

  @Get('questionById/:questionId')
  @ApiOperation({ summary: 'Get the questions by Id' })
  @ApiBearerAuth()
  async getQuestionById(
    @Param('questionId') questionId: number
  ) {
    const res = await this.codingPlatformService.getQuestionById(questionId);
    return res;
  }

}