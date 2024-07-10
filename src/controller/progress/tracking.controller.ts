import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  BadRequestException,
  Query,
  Req
} from '@nestjs/common';
import { TrackingService } from './tracking.service';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiCookieAuth,
  ApiOAuth2,
  ApiBearerAuth,
  ApiExtraModels,
  ApiBody,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  CreateAssignmentDto,
  PatchAssignmentDto,
  TimeLineAssignmentDto,
  SubmitBodyDto,
} from './dto/assignment.dto';
import { CreateArticleDto } from './dto/article.dto';
import { UpdateProjectDto } from './dto/project.dto';
import { CreateQuizDto, McqCreateDto, PutQuizDto } from './dto/quiz.dto';
import { quizBatchDto } from '../content/dto/content.dto';

@Controller('tracking')
@ApiTags('tracking')
// @ApiCookieAuth()
// @UsePipes(new ValidationPipe({
//     whitelist: true,
//     transform: true,
//     forbidNonWhitelisted: true,
// }))
// @ApiOAuth2(['pets:write'])

// @UseGuards(AuthGuard('cookie'))
export class TrackingController {
  constructor(private TrackingService: TrackingService) {}

  // @Get('/:user_id/:module_id')
  // @ApiOperation({ summary: 'Get the progress by user_id' })
  // @ApiBearerAuth()
  // async getTracking(
  //   @Param('userID') userID: number,
  //   @Param('moduleID') moduleID: number,
  //   @Param('bootcampID') bootcampID: number,
  // ): Promise<object> {
  //   const [err, res] = await this.TrackingService.getProgress(
  //     userID,
  //     moduleID,
  //     bootcampID,
  //   );
  //   if (err) {
  //     throw new BadRequestException(err);
  //   }
  //   return res;
  // }

  // @Post('/assignment/timeline')
  // @ApiOperation({ summary: 'Create assignment Time Line' })
  // @ApiBearerAuth()
  // async assignmentTimeLine(
  //   @Body() data: TimeLineAssignmentDto,
  // ): Promise<object> {
  //   const [err, res] = await this.TrackingService.assignmentTimeLine(data);
  //   if (err) {
  //     throw new BadRequestException(err);
  //   }
  //   return res;
  // }

  // @Post('/assignment')
  // @ApiOperation({ summary: 'Create assignment submission' })
  // @ApiBearerAuth()
  // async assignmentSubmission(
  //   @Body() data: CreateAssignmentDto,
  //   @Query('bootcamp_id') bootcampId: number,
  //   @Query('assignment_id') assignmentId: number,
  //   @Query('user_id') userId: number,
  // ): Promise<object> {
  //   const [err, res] = await this.TrackingService.submissionAssignment(
  //     data,
  //     bootcampId,
  //     assignmentId,
  //     userId,
  //   );

  //   if (err) {
  //     throw new BadRequestException(err);
  //   }
  //   return res;
  // }

  // @Get('/assignment/upcomming/:user_id')
  // @ApiOperation({
  //   summary: 'Get assignment upcomming by user_id and bootcamp_id',
  // })
  // @ApiBearerAuth()
  // async getAssignmentUpcomming(
  //   @Param('user_id') user_id: number,
  //   @Query('bootcamp_id') bootcamp_id: number,
  // ): Promise<object> {
  //   const [err, res] = await this.TrackingService.getAssignmentUpcomming(
  //     user_id,
  //     bootcamp_id,
  //   );
  //   if (err) {
  //     throw new BadRequestException(err);
  //   }
  //   return res;
  // }

  // @Get('/assignment/:assignmentId/:userId')
  // @ApiOperation({ summary: 'Update assignment submission by id' })
  // @ApiBearerAuth()
  // async getAssignmentSubmissionBy(
  //   @Param('assignmentId') assignmentId: number,
  //   @Param('userId') userId: number,
  // ): Promise<object> {
  //   const [err, res] = await this.TrackingService.assignmentSubmissionBy(
  //     userId,
  //     assignmentId,
  //   );
  //   if (err) {
  //     throw new BadRequestException(err);
  //   }
  //   return res;
  // }

  // @Patch('/assignment/:id')
  // @ApiOperation({ summary: 'Update assignment submission by id' })
  // @ApiBearerAuth()
  // async updateAssignmentSubmission(
  //   @Param('id') id: number,
  //   @Body() data: PatchAssignmentDto,
  // ): Promise<object> {
  //   const [err, res] = await this.TrackingService.updateAssignmentSubmission(
  //     id,
  //     data,
  //   );
  //   if (err) {
  //     throw new BadRequestException(err);
  //   }
  //   return res;
  // }

  // @Post('/article')
  // @ApiOperation({ summary: 'Create article submission' })
  // @ApiBearerAuth()
  // async articleTracking(
  //   @Body() data: CreateArticleDto,
  //   @Query('bootcampId') bootcampId: number,
  // ): Promise<object> {
  //   const [err, res] = await this.TrackingService.createArticleTracking(
  //     data,
  //     bootcampId,
  //   );
  //   if (err) {
  //     throw new BadRequestException(err);
  //   }
  //   return res;
  // }

  // @Get('/article/:user_id')
  // @ApiOperation({ summary: 'Get article submission by user_id' })
  // @ApiBearerAuth()
  // async getarticleSubmission(
  //   @Param('user_id') user_id: number,
  // ): Promise<object> {
  //   const [err, res] = await this.TrackingService.getArticleTracking(user_id);
  //   if (err) {
  //     throw new BadRequestException(err);
  //   }
  //   return res;
  // }

  // @Get('/article/:articleId/:userId')
  // @ApiOperation({ summary: 'Update article submission by id' })
  // @ApiBearerAuth()
  // async getArticleSubmission(
  //   @Param('articleId') articleId: number,
  //   @Param('userId') userId: number,
  // ): Promise<object> {
  //   const [err, res] = await this.TrackingService.articleTrackingBy(
  //     articleId,
  //     userId,
  //   );
  //   if (err) {
  //     throw new BadRequestException(err);
  //   }
  //   return res;
  // }

  // @Post('/quiz')
  // @ApiOperation({ summary: 'Create quiz submission' })
  // @ApiBearerAuth()
  // async quizTracking(@Body() data: CreateQuizDto): Promise<object> {
  //   data.quiz.filter((q) => {
  //     q['userId'] = data.userId;
  //     q['moduleId'] = data.moduleId;
  //     q['quizId'] = data.quizId;
  //   });
  //   const [err, res] = await this.TrackingService.createQuizTracking(
  //     data.quiz,
  //     data.bootcampId,
  //   );
  //   if (err) {
  //     throw new BadRequestException(err);
  //   }
  //   return res;
  // }

  // @Get('/quiz/:user_id')
  // @ApiOperation({ summary: 'Get quiz submission by user_id' })
  // @ApiBearerAuth()
  // async getQuizSubmission(@Param('user_id') user_id: number): Promise<object> {
  //   const [err, res] = await this.TrackingService.getQuizTracking(user_id);
  //   if (err) {
  //     throw new BadRequestException(err);
  //   }
  //   return res;
  // }

  // @Get('/quiz/:quizId/:userId')
  // @ApiOperation({ summary: 'Update quiz submission by id' })
  // @ApiBearerAuth()
  // async quizSubmission(
  //   @Param('quizId') quizId: number,
  //   @Param('userId') userId: number,
  // ): Promise<object> {
  //   const [err, res] = await this.TrackingService.quizTrackBy(quizId, userId);
  //   if (err) {
  //     throw new BadRequestException(err);
  //   }
  //   return res;
  // }

  // @Put('/quiz/:id')
  // @ApiOperation({ summary: 'Update quiz submission by id' })
  // @ApiBearerAuth()
  // async updateQuizSubmission(
  //   @Param('id') id: number,
  //   @Body() data: PutQuizDto,
  // ): Promise<object> {
  //   const [err, res] = await this.TrackingService.updateQuizTracking(id, data);
  //   if (err) {
  //     throw new BadRequestException(err);
  //   }
  //   return res;
  // }

  // @Put('/update/:userId/:bootcampId')
  // @ApiOperation({ summary: 'Update progress submission by user_id' })
  // @ApiBearerAuth()
  // async updateProgress(
  //   @Param('userId') userId: number,
  //   @Param('bootcampId') bootcampId: number,
  // ): Promise<object> {
  //   const [err, res] = await this.TrackingService.updateBootcampProgress(
  //     userId,
  //     bootcampId,
  //   );
  //   if (err) {
  //     throw new BadRequestException(err);
  //   }
  //   return res;
  // }

  // @Get('/latest/learning/:userId')
  // @ApiOperation({ summary: 'Get latest learning progress by user_id' })
  // @ApiBearerAuth()
  // async latestLearningProgress(
  //   @Param('userId') userId: number,
  // ): Promise<object> {
  //   const [err, res] = await this.TrackingService.getLatestIds(userId);
  //   if (err) {
  //     throw new BadRequestException(err);
  //   }
  //   return res;
  // }

  @Post('updateChapterStatus/:bootcampId/:moduleId')
  @ApiOperation({ summary: 'Update Chapter status' })
  @ApiBearerAuth()
  async updateChapterStatus(
    @Param('bootcampId') bootcampId: number,
    @Req() req,
    @Param('moduleId') moduleId: number,
    @Query('chapterId') chapterId: number,
  ) {
    const res = await this.TrackingService.updateChapterStatus(
      bootcampId,
      req.user[0].id,
      moduleId,
      chapterId
    );
    return res;
  }

  @Get('/getAllChaptersWithStatus/:moduleId')
  @ApiOperation({
    summary: 'Get all chapters with status for a user by bootcampId',
  })
  @ApiBearerAuth()
  async getAllChapterForUser(
    @Param('moduleId') moduleId: number,
    @Req() req
  ) {
    const res = await this.TrackingService.getAllChapterWithStatus(
      moduleId,
      req.user[0].id,
    );
    return res;
  }

  @Post('updateQuizAndAssignmentStatus/:bootcampId/:moduleId')
  @ApiOperation({ summary: 'Update Chapter status' })
  @ApiBody({ type: SubmitBodyDto, required: false })
  @ApiBearerAuth()
  async updateQuizAndAssignmentStatus(
    @Param('bootcampId') bootcampId: number,
    @Req() req,
    @Param('moduleId') moduleId: number,
    @Query('chapterId') chapterId: number,
    @Body() submitBody: SubmitBodyDto,
  ) {
    const res = await this.TrackingService.updateQuizAndAssignmentStatus(
      req.user[0].id,
      moduleId,
      chapterId,
      bootcampId,
      submitBody,
    );
    return res;
  }

  @Get('/allModulesForStudents/:bootcampId')
  @ApiOperation({ summary: 'Get all modules of a course' })
  @ApiBearerAuth()
  async getAllModules(
    @Param('bootcampId') bootcampId: number,
    @Req() req,
  ) {
    const res = await this.TrackingService.getAllModuleByBootcampIdForStudent(
      bootcampId,
      req.user[0].id,
    );
    return res;
  }

  @Get('/bootcampProgress/:bootcampId')
  @ApiOperation({ summary: 'Get bootcamp progress for a user' })
  @ApiBearerAuth()
  async getBootcampProgress(
    @Param('bootcampId') bootcampId: number,
    @Req() req,
  ) {
    const res = await this.TrackingService.getBootcampTrackingForAUser(
      bootcampId,
      req.user[0].id,
    );
    return res;
  }

  @Get('/upcomingSubmission/:bootcampId')
  @ApiOperation({ summary: 'Get upcoming assignment submission' })
  @ApiBearerAuth()
  async getUpcomingAssignment(
    @Param('bootcampId') bootcampId: number,
    @Req() req,
  ) {
    const res = await this.TrackingService.getPendingAssignmentForStudent(
      bootcampId,
      req.user[0].id
    );
    return res;
  }

  @Get('/getChapterDetailsWithStatus/:chapterId')
  @ApiOperation({
    summary: 'Get chapter details for a user along with status',
  })
  @ApiBearerAuth()
  async getChapterDetailsForUser(
    @Param('chapterId') chapterId: number,
    @Req() req,
  ) {
    const res = await this.TrackingService.getChapterDetailsWithStatus(
      chapterId,
      req.user[0].id,
    );
    return res;
  }

  @Get('getAllQuizAndAssignmentWithStatus/:moduleId')
  @ApiOperation({ summary: 'get All Quiz And Assignment With Status' })
  @ApiBearerAuth()
  async getAllQuizAndAssignmentWithStatus(
    @Req() req,
    @Param('moduleId') moduleId: number,
    @Query('chapterId') chapterId: number,
  ) {
    const res = await this.TrackingService.getAllQuizAndAssignmentWithStatus(
      req.user[0].id,
      moduleId,
      chapterId,
    );
    return res;
  }

  @Post('updateProject/:projectId')
  @ApiOperation({ summary: 'Update project for a user' })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'moduleId',
    required: true,
    type: Number,
    description: 'moduleId',
  })
  @ApiQuery({
    name: 'bootcampId',
    required: true,
    type: Number,
    description: 'bootcampId',
  })
  async updateProject(
    @Param('projectId') projectId: number,
    @Req() req,
    @Query('moduleId') moduleId: number,
    @Query('bootcampId') bootcampId: number,
    @Body() submitProject:UpdateProjectDto
  ) {
    const res = await this.TrackingService.submitProjectForAUser(
      req.user[0].id,
      bootcampId,
      moduleId,
      projectId,
      submitProject
    );
    return res;
  }

  @Get('/getProjectDetailsWithStatus/:projectId/:moduleId')
  @ApiOperation({
    summary: 'Get project details details for a user along with status',
  })
  @ApiBearerAuth()
  async getProjectDetailsForUser(
    @Param('projectId') projectId: number,
    @Param('moduleId') moduleId: number,
    @Req() req,
  ) {
    const res = await this.TrackingService.getProjectDetailsWithStatus(
      projectId,
      moduleId,
      req.user[0].id
    );
    return res;
  }

  @Get('/allBootcampProgress')
  @ApiOperation({
    summary: 'Get all bootcamp progress for a particular student',
  })
  @ApiBearerAuth()
  async getAllBootcampProgressForStudents(
    @Req() req,
  ) {
    const res = await this.TrackingService.allBootcampProgressForStudents(
      req.user[0].id
    );
    return res;
  }

  @Get('/latestUpdatedCourse')
  @ApiOperation({
    summary: 'Get all bootcamp progress for a particular student',
  })
  @ApiBearerAuth()
  async getLatestUpdatedCourseForStudent(
    @Req() req,
  ) {
    const res = await this.TrackingService.getLatestUpdatedCourseForStudents(
      req.user[0].id
    );
    return res;
  }

  @Get('assessment/submissionId=:submissionId')
  @ApiOperation({ summary: 'Get assessment submission by submissionId' })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'studentId',
    required: false,
    type: Number,
    description: 'studentId of the assessment',
  })
  async getAssessmentSubmission(
    @Param('submissionId') submissionId: number, @Req() req, @Query('studentId') userId:number ) {
    if (!userId) {
        userId = req.user[0].id;
    }
    const res = await this.TrackingService.getAssessmentSubmission(submissionId, userId);
    return res;
  }   
}
