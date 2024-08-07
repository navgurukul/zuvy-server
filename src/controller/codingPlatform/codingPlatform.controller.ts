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
  Res
} from '@nestjs/common';
import { CodingPlatformService } from './codingPlatform.service';
import {
  ApiTags,
  ApiBody,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { SubmitCodeDto, CreateProblemDto, updateProblemDto, TestCaseDto } from './dto/codingPlatform.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ErrorResponse, SuccessResponse } from 'src/errorHandler/handler';
import { Response } from 'express';

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
    @Res() res: Response
  ) {
    try {
      let [err, success] = await this.codingPlatformService.submitPracticeCode(questionId, sourceCode, action, req.user[0].id, submissionId, codingOutsourseId);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
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
  async getPracticeCodeById(@Param('questionId') questionId: number, @Req() req, @Query('assessmentSubmissionId') submissionId: number, @Query('codingOutsourseId') codingOutsourseId: number, @Res() res: Response) {
    try {
      let [err, success] = await this.codingPlatformService.getPracticeCode(questionId, req.user[0].id, submissionId, codingOutsourseId);
      if (err) {
        return ErrorResponse.BadRequestException(err.message, err.statusCode)
      }
      return new SuccessResponse(success.message, success.statusCode, success).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('submission/:questionId')
  @ApiOperation({ summary: 'Get all submission by question id' })
  @ApiBearerAuth()
  async getSubmissionByQuestionId(@Param('questionId') questionId: number, @Res() res: Response) {
    try {
      let [err, success] = await this.codingPlatformService.getSubmissionByQuestionId(questionId);
      console.log(err, success);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);

      }
      return new SuccessResponse(success.message, success.statusCode, success.submissions).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Post('create-question')
  @ApiOperation({ summary: 'Create coding question with test cases' })
  @ApiBearerAuth()
  async createCodingQuestion(@Body() createCodingQuestionDto: CreateProblemDto, @Res() res: Response): Promise<any> {
    try {
      const [err, success] = await this.codingPlatformService.createCodingQuestion(createCodingQuestionDto);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Put('update-question/:id')
  @ApiOperation({ summary: 'Update coding question' })
  @ApiBearerAuth()
  async updateCodingQuestion(@Param('id') id: number, @Body() updateCodingQuestionDto: updateProblemDto, @Res() res: Response) {
    try {
      const [err, success] = await this.codingPlatformService.updateCodingQuestion(id, updateCodingQuestionDto);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Delete('delete-question/:id')
  @ApiOperation({ summary: 'Delete coding question' })
  @ApiBearerAuth()
  async deleteCodingQuestion(@Param('id') id: number, @Res() res: Response): Promise<any> {
    try {
      const [err, success] = await this.codingPlatformService.deleteCodingQuestion(id);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Delete('delete-testcase/:id')
  @ApiOperation({ summary: 'Delete coding Testcase' })
  @ApiBearerAuth()
  async deleteCodingTestcase(@Param('id') id: number, @Res() res: Response): Promise<any> {
    try {
      const [err, success] = await this.codingPlatformService.deleteCodingTestcase(id);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('get-coding-question/:id')
  @ApiOperation({ summary: 'Get coding question' })
  @ApiBearerAuth()
  async getCodingQuestion(@Param('id') id: number, @Res() res: Response): Promise<any> {
    try {
      const [err, success] = await this.codingPlatformService.getCodingQuestion(id);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Post('add-test-case/:question_id')
  @ApiOperation({ summary: 'Add test case to coding question' })
  @ApiBearerAuth()
  async addTestCase(@Param('question_id') question_id: number, @Body() updateTestCaseDto: TestCaseDto, @Res() res: Response): Promise<any> {
    try {
      const [err, success] = await this.codingPlatformService.addTestCase(question_id, updateTestCaseDto);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }
}
