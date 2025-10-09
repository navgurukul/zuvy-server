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
  Res,
  UseGuards,
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
import { InstructorFeedbackDto, PatchOpenendedQuestionDto, CreateOpenendedQuestionDto, SubmissionassessmentDto, StartAssessmentDto, OpenEndedQuestionSubmissionDtoList, QuizSubmissionDtoList, PropertingPutBody } from './dto/submission.dto';
import { ErrorResponse, SuccessResponse } from 'src/errorHandler/handler';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('submission')
@ApiTags('submissions')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class SubmissionController {
  constructor(private submissionService: SubmissionService) { }

  @Get('/submissionsOfPractiseProblems/:bootcampId')
  @ApiOperation({ summary: 'Get the submission by bootcampId' })
  @ApiQuery({
    name: 'searchPractiseProblem',
    required: false,
    type: String,
    description: 'Search by practise problem name',
  })
  @ApiQuery({
    name: 'searchStudent',
    required: false,
    type: String,
    description: 'Search by student name or email',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    type: String,
    description: 'Field to order by (submittedDate, percentage, name, email)',
    enum: ['submittedDate', 'name', 'email']
  })
  @ApiQuery({
    name: 'orderDirection',
    required: false,
    type: String,
    description: 'Order direction (asc/desc)',
    enum: ['asc', 'desc']
  })
  async getChapterTracking(@Param('bootcampId') bootcampId: number, @Query('searchPractiseProblem') searchProblem: string, @Query('orderBy') orderBy?: 'submittedDate' | 'name' | 'email', @Query('orderDirection') orderDirection?: 'asc' | 'desc', @Query('searchStudent') searchStudent?: string) {
    return this.submissionService.getSubmissionOfPractiseProblem(bootcampId, searchProblem, orderBy, orderDirection, searchStudent);
  }

  @Get('/practiseProblemStatus/:moduleId')
  @ApiOperation({ summary: 'Get the status of practise Problems' })
  @ApiQuery({ name: 'chapterId', required: true, type: Number, description: 'chapter id' })
  @ApiQuery({ name: 'questionId', required: false, type: Number, description: 'question Id' })
  @ApiQuery({ name: 'batchId', required: false, type: Number, description: 'Batch id (optional)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'limit (optional)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'offset (optional)' })
  @ApiQuery({ name: 'searchStudent', required: false, type: String, description: 'Search by name or email' })
  @ApiQuery({ name: 'orderBy', required: false, type: String, description: 'Field to order by (submittedDate, percentage, name, email)', enum: ['submittedDate', 'percentage', 'name', 'email'] })
  @ApiQuery({ name: 'orderDirection', required: false, type: String, description: 'Order direction (asc/desc)', enum: ['asc', 'desc'] })
  async getStatusOfPractiseProblem(
    @Param('moduleId') moduleId: number,
    @Query('chapterId') chapterId: number,
    @Query('questionId') questionId: number,
    @Query('batchId') batchId?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('searchStudent') searchStudent?: string,
    @Query('orderBy') orderBy?: string,
    @Query('orderDirection') orderDirection?: string,
  ) {
    return this.submissionService.practiseProblemStatusOfStudents(
      questionId,
      chapterId,
      moduleId,
      batchId,
      limit,
      offset,
      searchStudent,
      orderBy,
      orderDirection
    );
  }

  @Get('/assessmentInfoBy')
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
  @ApiQuery({
    name: 'orderBy',
    required: false,
    type: String,
    description: 'Field to order by (submittedDate, name, email)',
    enum: ['submittedDate', 'name', 'email']
  })
  @ApiQuery({
    name: 'orderDirection',
    required: false,
    type: String,
    description: 'Order direction (asc/desc)',
    enum: ['asc', 'desc']
  })
  async getAssessmentInfoBy(
    @Query('bootcampId') bootcampId: number,
    @Query('limit') limit: number,
    @Query('offset') offset: number
  ) {
    return this.submissionService.getAssessmentInfoBy(bootcampId, limit, offset);
  }


  @Post('/openended/questions')
  async submissionOpenended(@Body() data: CreateOpenendedQuestionDto, @Req() req) {
    return this.submissionService.submissionOpenended(data, req.user[0].id);
  }

  @Patch('/openended/questions')
  async patchOpenendedQuestion(@Body() data: PatchOpenendedQuestionDto, @Query('id') id: number) {
    return this.submissionService.patchOpenendedQuestion(data, id);
  }

  @Post('/instructor/feedback')
  async instructorFeedback(@Body() data: InstructorFeedbackDto, @Query('id') id: number) {
    return this.submissionService.instructorFeedback(data, id);
  }

  @Get('/openended/questions')
  async getOpenendedQuestionSubmission(@Query('id') id: number) {
    return this.submissionService.getOpenendedQuestionSubmission(id);
  }

  @Patch('/assessment/submit')

  async assessmentSubmission(@Body() data: SubmissionassessmentDto, @Query('assessmentSubmissionId') assessmentSubmissionId: number, @Req() req,
    @Res() res
  ) {
    try {
      let [err, success] = await this.submissionService.assessmentSubmission(data, assessmentSubmissionId, req.user[0].id);
      if (err) {
        return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res)
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('/submissionsOfProjects/:bootcampId')
  @ApiOperation({ summary: 'Get the submission of projects by bootcampId' })
  @ApiQuery({
    name: 'searchProject',
    required: false,
    type: String,
    description: 'Search by project name',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    type: String,
    description: 'Field to order by (submittedDate, name, email)',
    enum: ['submittedDate', 'percentage', 'name', 'email']
  })
  @ApiQuery({
    name: 'orderDirection',
    required: false,
    type: String,
    description: 'Order direction (asc/desc)',
    enum: ['asc', 'desc']
  })
  async getProjectSubmissions(@Param('bootcampId') bootcampId: number, @Query('searchProject') projectName: string) {
    return this.submissionService.getAllProjectSubmissions(bootcampId, projectName);
  }

  @Get('/projects/students')
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
  @ApiQuery({
    name: 'searchStudent',
    required: false,
    type: String,
    description: 'Search by name or email',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    type: String,
    description: 'Field to order by (submittedDate, name, email)',
    enum: ['submittedDate', 'name', 'email']
  })
  @ApiQuery({
    name: 'orderDirection',
    required: false,
    type: String,
    description: 'Order direction (asc/desc)',
    enum: ['asc', 'desc']
  })
  @ApiQuery({
    name: 'projectId',
    required: true,
    type: Number,
    description: 'Project Id',
  })
  @ApiQuery({
    name: 'bootcampId',
    required: true,
    type: Number,
    description: 'Bootcamp Id',
  })
  @ApiQuery({
    name: 'batchId',
    required: false,
    type: Number,
    description: 'Batch id (optional)',
  })
  async projectStudentsInfoBy(
    @Query('projectId') projectId: number,
    @Query('bootcampId') bootcampId: number,
    @Query('batchId') batchId?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('searchStudent') searchStudent?: string,
    @Query('orderBy') orderBy?: 'submittedDate' | 'name' | 'email',
    @Query('orderDirection') orderDirection?: 'asc' | 'desc',
  ) {
    return this.submissionService.getUserDetailsForProject(
      projectId,
      bootcampId,
      batchId,
      limit,
      offset,
      searchStudent,
      orderBy,
      orderDirection
    );
  }

  @Get('/projectDetail/:userId')
  async projectStudentsDetails(
    @Query('projectId') projectId: number,
    @Query('bootcampId') bootcampId: number,
    @Param('userId') userId: number
  ) {
    return this.submissionService.getProjectDetailsForAUser(projectId, userId, bootcampId);
  }

  @Patch('/quiz/assessmentSubmissionId=:assessmentSubmissionId')
  async submitQuiz(@Body() QuizSubmission: QuizSubmissionDtoList,
    @Param('assessmentSubmissionId') assessmentSubmissionId: number,
    @Query('assessmentOutsourseId') assessmentOutsourseId: number,
    @Req() req,
    @Res() res
  ) {
    try {
      let [err, success] = await this.submissionService.submitQuiz(QuizSubmission.quizSubmissionDto, req.user[0].id, assessmentSubmissionId, assessmentOutsourseId);
      if (err) {
        return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res)
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Patch("/openended/assessmentSubmissionId=:assessmentSubmissionId")
  async submitOpenended(@Body() OpenEndedQuestionSubmission: OpenEndedQuestionSubmissionDtoList, @Param('assessmentSubmissionId') assessmentSubmissionId: number, @Req() req) {
    return this.submissionService.submitOpenEndedQuestion(OpenEndedQuestionSubmission.openEndedQuestionSubmissionDto, req.user[0].id, assessmentSubmissionId);
  }

  @Get('/submissionsOfForms/:bootcampId')
  @ApiOperation({ summary: 'Get the submission by bootcampId' })
  @ApiQuery({
    name: 'searchForm',
    required: false,
    type: String,
    description: 'Search by form name',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of items to skip',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    type: String,
    description: 'Field to order by (submittedDate, name, email)',
    enum: ['submittedDate', 'name', 'email']
  })
  @ApiQuery({
    name: 'orderDirection',
    required: false,
    type: String,
    description: 'Order direction (asc/desc)',
    enum: ['asc', 'desc']
  })
  async getSubmissionOfForms(
    @Param('bootcampId') bootcampId: number,
    @Query('searchForm') searchForm?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ) {
    return this.submissionService.getSubmissionOfForms(bootcampId, searchForm, limit, offset);
  }

  @Get('/formsStatus/:bootcampId/:moduleId')
  @ApiOperation({ summary: 'Get the status of forms' })
  @ApiQuery({ name: 'chapterId', required: true, type: Number, description: 'chapter id' })
  @ApiQuery({ name: 'batchId', required: false, type: Number, description: 'Batch id (optional)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'limit (optional)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'offset (optional)' })
  @ApiQuery({ name: 'searchStudent', type: String, required: false, description: 'Search by student name or email' })
  @ApiQuery({ name: 'orderBy', required: false, type: String, description: 'Field to order by (submittedDate, name, email)', enum: ['submittedDate', 'name', 'email'] })
  @ApiQuery({ name: 'orderDirection', required: false, type: String, description: 'Order direction (asc/desc)', enum: ['asc', 'desc'] })
  async getStatusOfForms(
    @Param('bootcampId') bootcampId: number,
    @Param('moduleId') moduleId: number,
    @Query('chapterId') chapterId: number,
    @Query('batchId') batchId?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('searchStudent') searchStudent?: string,
    @Query('orderBy') orderBy?: string,
    @Query('orderDirection') orderDirection?: string
  ) {
    return this.submissionService.formsStatusOfStudents(
      bootcampId,
      chapterId,
      moduleId,
      batchId,
      limit,
      offset,
      searchStudent,
      orderBy,
      orderDirection
    );
  }

  @Get('getFormDetailsById/:moduleId')
  @ApiOperation({ summary: 'get Form details by Id' })
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
  @ApiQuery({
    name: 'searchAssignment',
    required: false,
    type: String,
    description: 'Search by assignment name',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    type: String,
    description: 'Field to order by (submittedDate, name, email)',
    enum: ['submittedDate', 'name', 'email']
  })
  @ApiQuery({
    name: 'orderDirection',
    required: false,
    type: String,
    description: 'Order direction (asc/desc)',
    enum: ['asc', 'desc']
  })
  async getAssignmentSubmission(@Param('bootcampId') bootcampId: number, @Query('searchAssignment') assignmentName: string, @Res() res) {
    try {
      let [err, success] = await this.submissionService.getSubmissionOfAssignment(bootcampId, assignmentName)
      if (err) {
        return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res)
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('/assignmentStatus')
  @ApiOperation({ summary: 'Get the status of assignment' })
  @ApiQuery({ name: 'chapterId', required: true, type: Number, description: 'chapter id' })
  @ApiQuery({ name: 'batchId', required: false, type: Number, description: 'Batch id (optional)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'limit (optional)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'offset (optional)' })
  @ApiQuery({ name: 'searchStudent', required: false, type: String, description: 'Search by name or email' })
  @ApiQuery({ name: 'orderBy', required: false, type: String, description: 'Field to order by (submittedDate, name, email)', enum: ['submittedDate', 'name', 'email'] })
  @ApiQuery({ name: 'orderDirection', required: false, type: String, description: 'Order direction (asc/desc)', enum: ['asc', 'desc'] })
  async getStatusOfAssignment(
    @Query('chapterId') chapterId: number,
    @Query('batchId') batchId?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('searchStudent') searchStudent?: string,
    @Query('orderBy') orderBy?: string,
    @Query('orderDirection') orderDirection?: string,
    @Res() res?: any
  ) {
    try {
      let [err, success] = await this.submissionService.assignmentStatusOfStudents(
        chapterId,
        batchId,
        limit,
        offset,
        searchStudent,
        orderBy,
        orderDirection
      );
      if (err) {
        return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res)
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('getAssignmentDetailForAUser')
  @ApiOperation({ summary: 'get assignment detail of a student' })
  async getAssignmentDetailForAUser(
    @Query('chapterId') chapterId: number,
    @Query('userId') userId: number,
    @Res() res
  ) {
    try {
      let [err, success] = await this.submissionService.getAssignmentSubmissionDetailForUser(
        chapterId,
        userId
      );
      if (err) {
        return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res)
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  // put api endpoint: assessment/properting
  @Patch("/assessment/properting")
  @ApiOperation({ summary: 'Updating the assignment properting data' })
  async submitProperting(@Body() propertingPutBody: PropertingPutBody, @Query('assessment_submission_id') assessmentSubmissionId: number, @Res() res) {
    try {
      let [err, success] = await this.submissionService.submitProperting(assessmentSubmissionId, propertingPutBody);
      if (err) {
        return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res)
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }
  //recalcOnlyMCQ
  @Patch("/assessment/recalcOnlyMCQ")
  @ApiOperation({ summary: 'Recalculating the MCQ score' })
  async recalcAndFixMCQForAssessment(@Query('assessment_outsourse_id') assessmentOutsourseId: number, @Res() res) {
    try {
      let [err, success] = await this.submissionService.recalcAndFixMCQForAssessment(assessmentOutsourseId);
      if (err) {
        return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res)
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  // Live session  submissions Tab admin side api

  @Get('livesession/zuvy_livechapter_submissions')

  @ApiQuery({
    name: 'bootcamp_id',
    required: true,
    type: String,
    description: 'Bootcamp Id',
  })

  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search by module or chapter name',
  })

  @ApiQuery({
    name: 'limit',
    required: false,
    type: String,
    description: 'Limit the number of results',
  })

  @ApiQuery({
    name: 'offset',
    required: false,
    type: String,
    description: 'Offset the results by this amount',
  })

  @ApiOperation({ summary: 'Get chapter tracking data for Live sessions inside modules' })
  async getLiveChapterSubmissions(
    @Query('bootcamp_id') bootcampId: number,
    @Query('searchTerm') searchTerm: string,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Res() res
  ) {
    try {
      // Service should return: { trackingData: [...], totalStudents: N }
      const [err, result] = await this.submissionService.getLiveChapterSubmissions(bootcampId, searchTerm, limit, offset);
      if (err) {
        return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res);
      }
      return new SuccessResponse(
        'Submission of live sessions for modules has been fetched',
        200,
        result
      ).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  // Live session submissions session chapter id wise data
  @Get('livesession/zuvy_livechapter_student_submission/:module_chapter_id')
  @ApiOperation({ summary: 'Get live session submission data for a module chapter (session view)' })

  @ApiQuery({
    name: 'limit',
    required: false,
    type: String,
    description: 'Limit the number of results',
  })

  @ApiQuery({
    name: 'offset',
    required: false,
    type: String,
    description: 'Offset the results by this amount',
  })

  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description: 'Filter by student name',
  })

  @ApiQuery({
    name: 'email',
    required: false,
    type: String,
    description: 'Filter by student email',
  })

  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by attendance status (present or absent)',
  })
  async getLiveChapterStudentSubmission(
    @Param('module_chapter_id') moduleChapterId: number,
    @Res() res?: any,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query('status') status?: 'present' | 'absent'
  ) {
    try {
      const [err, result] = await this.submissionService.getLiveChapterStudentSubmission(moduleChapterId, limit, offset, name, email, status);
      if (err) {
        return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res);
      }
      return new SuccessResponse(
        'Submission of live sessions for module chapter has been fetched',
        200,
        result
      ).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }
}
