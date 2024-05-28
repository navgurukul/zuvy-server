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
 import { SubmissionService } from './submission.service';
  import {
    ApiTags,
    ApiBody,
    ApiOperation,
    ApiCookieAuth,
    ApiQuery,
  } from '@nestjs/swagger';
  import { ApiBearerAuth } from '@nestjs/swagger';
  @Controller('submission')
  @ApiTags('submission')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  export class SubmissionController {
    constructor(private submissionService: SubmissionService) {}
    @Get('/submissionsOfPractiseProblems/:bootcampId')
    @ApiOperation({ summary: 'Get the submission by bootcampId' })
    @ApiBearerAuth()
    async getChapterTracking(@Param('bootcampId') bootcampId: number) {
      const res = await this.submissionService.getSubmissionOfPractiseProblem(bootcampId);
      return res;
    }
  
    @Get('/practiseProblemStatus/:moduleId')
    @ApiOperation({ summary: 'Get the status of practise Problems' })
    @ApiQuery({
      name: 'chapterId',
      required: true,
      type: Number,
      description: 'chapter id',
    })
    @ApiQuery({
      name: 'questionId',
      required: true,
      type: Number,
      description: 'question Id',
    })
    @ApiQuery({
      name: 'limit',
      type: Number,
      description: 'limit',
    })
    @ApiQuery({
      name: 'offset',
      type: Number,
      description: 'offset',
    })
    @ApiBearerAuth()
    async getStatusOfPractiseProblem(
      @Param('moduleId') moduleId: number,
      @Query('chapterId') chapterId: number,
      @Query('questionId') questionId: number,
      @Query('limit') limit: number,
      @Query('offset') offset : number
    ) {
      const res = await this.submissionService.practiseProblemStatusOfStudents(
        questionId,
        chapterId,
        moduleId,
        limit,
        offset
      );
      return res;
    }

    // @Post('/assessment')
    // getAssessmentInfoBy

    @Get('/assessmentInfoBy')
    @ApiBearerAuth()
    @ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
    })
    @ApiQuery({
      name: 'offset',
      required: false,
      type: Number,
    })
    async getAssessmentInfoBy(
      @Query('bootcampId') bootcampId: number,
      @Query('limit') limit: number,
      @Query('offset') offset : number
    ){
      let res = await this.submissionService.getAssessmentInfoBy(bootcampId, limit, offset);
      return res;
    }

    @Get('/assessment/students')
    @ApiBearerAuth()
    @ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
    })
    @ApiQuery({
      name: 'offset',
      required: false,
      type: Number,
    })
    async assessmentStudentsInfoBy(
      @Query('assessmentId') assessmentId: number,
      @Query('bootcampId') bootcampId: number,
      @Query('limit') limit: number,
      @Query('offset') offset : number
    ){
      let res = await this.submissionService.assessmentStudentsInfoBy(assessmentId, limit, offset,bootcampId);
      return res;
    }
  }
  