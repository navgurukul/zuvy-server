import { Controller, Get, Post, Put, Patch, Delete, Body, Param, ValidationPipe, UsePipes, Optional, Query, BadRequestException, Req } from '@nestjs/common';
import { AdminAssessmentService } from './adminAssessment.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Request } from '@nestjs/common';
import { query } from 'express';


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
  @ApiBearerAuth()
  async AssessmentStudents(@Req() req: Request, @Param('assessment_id') assessmentID: number,@Query('searchStudent') searchStudent: string) {
    return this.adminAssessmentService.getAssessmentStudents(req, assessmentID,searchStudent);
  }
  // get assessment submission by student
  @Get('assessment/submission/user_id:user_id')
  @ApiOperation({ summary: 'Get the submission of student' })
  @ApiBearerAuth()
  async AssessmentSubmission(@Req() req: Request, @Param('user_id') userID: number, @Query('submission_id') submissionID: number) {
    return this.adminAssessmentService.getUserAssessmentSubmission(req,submissionID, userID);
  }

}
