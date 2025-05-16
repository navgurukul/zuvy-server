import { Controller, Get, Post, Put, Patch, Delete, Body, Param, ValidationPipe, UsePipes, Optional, Query, BadRequestException, Req, Res } from '@nestjs/common';
import { AdminAssessmentService } from './adminAssessment.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Request } from '@nestjs/common';
import { query } from 'express';
import { STATUS_CODES } from 'src/helpers';
import { ErrorResponse, SuccessResponse } from 'src/errorHandler/handler';
import { Response } from 'express';


@Controller('admin')
@ApiTags('admin')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
export class AdminAssessmentController {
  constructor(private adminAssessmentService: AdminAssessmentService) { }
  @Get('bootcampAssessment/bootcamp_id:bootcamp_id')
  @ApiOperation({ summary: 'Get the assessment of bootcamp' })
  @ApiQuery({
    name: 'searchAssessment',
    required: false,
    type: String,
    description: 'Search by assessment name',
  })
  @ApiBearerAuth()
  async BootcampAssessment(@Req() req: Request, @Param('bootcamp_id') bootcampID: number,@Query('searchAssessment') searchAssessment: string) {
    return this.adminAssessmentService.getBootcampAssessment(bootcampID,searchAssessment);
  }

    @Get('assessment/students/assessment_id:assessment_id')
  @ApiOperation({ summary: 'Get the students of assessment' })
  @ApiQuery({
    name: 'searchStudent',
    required: false,
    type: String,
    description: 'Search by name or email',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit the number of records',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Offset for pagination',
  })
  @ApiBearerAuth()
  async AssessmentStudents(
    @Req() req: Request,
    @Param('assessment_id') assessmentID: number,
    @Query('searchStudent') searchStudent: string,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
  ) {
    return this.adminAssessmentService.getAssessmentStudents(req, assessmentID, searchStudent, limit, offset);
  }
  // get assessment submission by student
  @Get('assessment/submission/user_id:user_id')
  @ApiOperation({ summary: 'Get the submission of student' })
  @ApiBearerAuth()
  async AssessmentSubmission(@Req() req: Request, @Param('user_id') userID: number, @Query('submission_id') submissionID: number) {
    return this.adminAssessmentService.getUserAssessmentSubmission(req,submissionID, userID);
  }

  @Get(':bootcamp_id/assessments')
  @ApiOperation({ summary: 'Get all assessments for a bootcamp' })
  @ApiBearerAuth()
  async AssessmentsAndStudents(
    @Param('bootcamp_id') bootcampID: number,
    @Res() res
  ) {
    try {
      const result = await this.adminAssessmentService.getAssessmentsAndStudents(bootcampID);

      if (result.statusCode === STATUS_CODES.NOT_FOUND) {
        return ErrorResponse.BadRequestException(result.message).send(res);
      }

      return new SuccessResponse('Assessments retrieved successfully', STATUS_CODES.OK, result).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('bootcampModuleCompletion/bootcamp_id:bootcamp_id')
  @ApiOperation({ summary: 'Get module completion data of a bootcamp' })
  @ApiQuery({
    name: 'searchVideos',
    required: false,
    type: String,
    description: 'Search by video name',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'limit',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'offset',
  })
  @ApiBearerAuth()
  async BootcampModuleCompletion(
    @Param('bootcamp_id') bootcampID: number,
    @Query('searchVideos') searchVideos: string,
    @Query('limit') limit: number,
    @Query('offset') offSet: number,
  ) {
    return this.adminAssessmentService.getBootcampModuleCompletion(bootcampID, searchVideos, limit, offSet);
  }

  @Get('moduleChapter/students/chapter_id:chapter_id')
  @ApiOperation({ summary: 'Get students of a module chapter' })
  @ApiQuery({
    name: 'searchStudent',
    required: false,
    type: String,
    description: 'Search by name or email',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'limit'
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'offset'
  })
  @ApiBearerAuth()
  async ModuleChapterStudents(
    @Param('chapter_id') chapterID: number,
    @Query('searchStudent') searchStudent: string,
    @Query('limit') limit: number,
    @Query('offset') offSet: number,
  ) {
    return this.adminAssessmentService.getModuleChapterStudents(chapterID, searchStudent, limit, offSet);
  }

  @Get('/leaderBoard/bootcampId:bootcampId')
  @ApiOperation({ summary: 'Get the leaderboard' })
  @ApiQuery({
    name: 'criteria',
    required: false,
    type: String,
    description: 'criteria',
  })
  @ApiQuery({
    name: 'assessmentOutsourseId',
    required: false,
    type: [Number],
    description: 'assessmentOutsourseId',

  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    description: 'limit',
    required: false
  })
  @ApiQuery({
    name: 'offset',
    type: Number,
    description: 'offset',
    required: false
  })
  @ApiBearerAuth()
  async getAdminLeaderboard(
    @Param('bootcampId') bootcampId: number,
    @Query('criteria') criteria: 'attendance' | 'bootcampProgress' | 'assessmentScore',
    @Query('assessmentOutsourseId') assessmentOutsourseId: number | number[],
    @Query('limit') limit: number,
    @Query('offset') offset: number
  ) {
    return this.adminAssessmentService.getLeaderboardByCriteria(bootcampId, criteria, assessmentOutsourseId, limit, offset);
  }

  @Post('assessment/approve-reattempt')
  @ApiOperation({ summary: 'Approve re-attempt for an assessment submission' })
  @ApiBearerAuth()
  async approveReattempt(
    @Query('assessmentSubmissionId') assessmentSubmissionId: number,
    @Req() req,
    @Res() res: Response
  ): Promise<any>  {
    try {
      let [err, success] = await this.adminAssessmentService.approveReattempt(assessmentSubmissionId);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Delete('assessment/reject-reattempt')
  @ApiOperation({ summary: 'Reject re-attempt for an assessment submission' })
  @ApiBearerAuth()
  async rejectReattempt(
    @Query('assessmentSubmissionId') assessmentSubmissionId: number,
    @Req() req,
    @Res() res: Response
  ): Promise<any>  {
    try {
      let [err, success] = await this.adminAssessmentService.rejectReattempt(assessmentSubmissionId);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }
}


