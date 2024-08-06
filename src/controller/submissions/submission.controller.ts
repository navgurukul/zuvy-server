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
import { InstructorFeedbackDto, PatchOpenendedQuestionDto, CreateOpenendedQuestionDto, SubmissionassessmentDto, StartAssessmentDto, OpenEndedQuestionSubmissionDtoList, QuizSubmissionDtoList } from './dto/submission.dto';

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
  constructor(private submissionService: SubmissionService) { }
  @Get('/submissionsOfPractiseProblems/:bootcampId')
  @ApiOperation({ summary: 'Get the submission by bootcampId' })
  @ApiBearerAuth()
  async getChapterTracking(@Param('bootcampId') bootcampId: number) {
    return this.submissionService.getSubmissionOfPractiseProblem(bootcampId);
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
    @Query('offset') offset: number
  ) {
    return this.submissionService.practiseProblemStatusOfStudents(
      questionId,
      chapterId,
      moduleId,
      limit,
      offset
    );
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
    @Query('offset') offset: number
  ) {
    return this.submissionService.getAssessmentInfoBy(bootcampId, limit, offset);
  }

  // @Get('/assessment/students')
  // @ApiBearerAuth()
  // @ApiQuery({
  //   name: 'limit',
  //   required: false,
  //   type: Number,
  // })
  // @ApiQuery({
  //   name: 'offset',
  //   required: false,
  //   type: Number,
  // })
  // async assessmentStudentsInfoBy(
  //   @Query('assessmentId') assessmentId: number,
  //   @Query('bootcampId') bootcampId: number,
  //   @Query('limit') limit: number,
  //   @Query('offset') offset : number
  // ){
  //   return this.submissionService.assessmentStudentsInfoBy(assessmentId, limit, offset,bootcampId);
  // }


  @Post('/openended/questions')
  @ApiBearerAuth()
  async submissionOpenended(@Body() data: CreateOpenendedQuestionDto, @Req() req) {
    return this.submissionService.submissionOpenended(data, req.user[0].id);
  }

  @Patch('/openended/questions')
  @ApiBearerAuth()
  async patchOpenendedQuestion(@Body() data: PatchOpenendedQuestionDto, @Query('id') id: number) {
    return this.submissionService.patchOpenendedQuestion(data, id);
  }

  @Post('/instructor/feedback')
  @ApiBearerAuth()
  async instructorFeedback(@Body() data: InstructorFeedbackDto, @Query('id') id: number) {
    return this.submissionService.instructorFeedback(data, id);
  }

  @Get('/openended/questions')
  @ApiBearerAuth()
  async getOpenendedQuestionSubmission(@Query('id') id: number) {
    return this.submissionService.getOpenendedQuestionSubmission(id);
  }

  @Patch('/assessment/submit')
  @ApiBearerAuth()
  async assessmentSubmission(@Body() data: SubmissionassessmentDto, @Query('assessmentSubmissionId') assessmentSubmissionId: number, @Req() req) {
    return this.submissionService.assessmentSubmission(data, assessmentSubmissionId);
  }

  // @Get('/assessment')
  // @ApiBearerAuth()
  // async getAssessmentSubmission(@Query('assessment_id') assessment_id: number,  @Req() req){
  //   return this.submissionService.getAssessmentSubmission(assessment_id, req.user[0].id);
  // }

  @Get('/submissionsOfProjects/:bootcampId')
  @ApiOperation({ summary: 'Get the submission of projects by bootcampId' })
  @ApiBearerAuth()
  async getProjectSubmissions(@Param('bootcampId') bootcampId: number) {
    return this.submissionService.getAllProjectSubmissions(bootcampId);
  }

  @Get('/projects/students')
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
  async projectStudentsInfoBy(
    @Query('projectId') projectId: number,
    @Query('bootcampId') bootcampId: number,
    @Query('limit') limit: number,
    @Query('offset') offset: number
  ) {
    return this.submissionService.getUserDetailsForProject(projectId, bootcampId, limit, offset);
  }

  @Get('/projectDetail/:userId')
  @ApiBearerAuth()
  async projectStudentsDetails(
    @Query('projectId') projectId: number,
    @Query('bootcampId') bootcampId: number,
    @Param('userId') userId: number
  ) {
    return this.submissionService.getProjectDetailsForAUser(projectId, userId, bootcampId);
  }

  @Patch('/quiz/assessmentSubmissionId=:assessmentSubmissionId')
  @ApiBearerAuth()
  async submitQuiz(@Body() QuizSubmission: QuizSubmissionDtoList, @Param('assessmentSubmissionId') assessmentSubmissionId: number, @Req() req) {
    return this.submissionService.submitQuiz(QuizSubmission.quizSubmissionDto, req.user[0].id, assessmentSubmissionId);
  }

  @Patch("/openended/assessmentSubmissionId=:assessmentSubmissionId")
  @ApiBearerAuth()
  async submitOpenended(@Body() OpenEndedQuestionSubmission: OpenEndedQuestionSubmissionDtoList, @Param('assessmentSubmissionId') assessmentSubmissionId: number, @Req() req) {
    return this.submissionService.submitOpenEndedQuestion(OpenEndedQuestionSubmission.openEndedQuestionSubmissionDto, req.user[0].id, assessmentSubmissionId);
  }

  @Get('/submissionsOfForms/:bootcampId')
  @ApiOperation({ summary: 'Get the submission by bootcampId' })
  @ApiBearerAuth()
  async getSubmissionOfForms(@Param('bootcampId') bootcampId: number) {
    return this.submissionService.getSubmissionOfForms(bootcampId);
  }

  @Get('/formsStatus/:bootcampId/:moduleId')
  @ApiOperation({ summary: 'Get the status of forms' })
  @ApiQuery({
    name: 'chapterId',
    required: true,
    type: Number,
    description: 'chapter id',
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
  async getStatusOfForms(
    @Param('bootcampId') bootcampId: number,
    @Param('moduleId') moduleId: number,
    @Query('chapterId') chapterId: number,
    @Query('limit') limit: number,
    @Query('offset') offset: number
  ) {
    return this.submissionService.formsStatusOfStudents(
      bootcampId,
      chapterId,
      moduleId,
      limit,
      offset
    );
  }

  @Get('getFormDetailsById/:moduleId')
  @ApiOperation({ summary: 'get Form details by Id' })
  @ApiBearerAuth()
  async getFormDetailsById(
    @Param('moduleId') moduleId: number,
    @Query('chapterId') chapterId: number,
    @Query('userId') userId: number,
  ) {
    const res = await this.submissionService.getFormDetailsById(
      moduleId,
      chapterId,
      userId
    );
    return res;
  }

  @Get('/submissionsOfAssignment/:bootcampId')
  @ApiOperation({ summary: 'Get the submission of assignment by bootcampId' })
  @ApiBearerAuth()
  async getAssignmentSubmission(@Param('bootcampId') bootcampId: number) {
    return this.submissionService.getSubmissionOfAssignment(bootcampId);
  }

  @Get('/assignmentStatus')
  @ApiOperation({ summary: 'Get the status of assignment' })
  @ApiQuery({
    name: 'chapterId',
    required: true,
    type: Number,
    description: 'chapter id',
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
  async getStatusOfAssignment(
    @Query('chapterId') chapterId: number,
    @Query('limit') limit: number,
    @Query('offset') offset: number
  ) {
    return this.submissionService.assignmentStatusOfStudents(
      chapterId,
      limit,
      offset
    );
  }

  @Get('getAssignmentDetailForAUser')
  @ApiOperation({ summary: 'get assignment detail of a student' })
  @ApiBearerAuth()
  async getAssignmentDetailForAUser(
    @Query('chapterId') chapterId: number,
    @Query('userId') userId: number,
  ) {
    const res = await this.submissionService.getAssignmentSubmissionDetailForUser(
      chapterId,
      userId
    );
    return res;
  }
}
