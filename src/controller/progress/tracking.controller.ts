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
  ForbiddenException,
  Query,
  Req,
  Res,
  UseGuards,
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
import { SubmitFormBodyDto } from './dto/form.dto';
import { ErrorResponse, SuccessResponse } from 'src/errorHandler/handler';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { TrackAction } from 'src/trackinglog/decorators/track-action.decorator';
import { SkipOrgCheck } from 'src/rbac/decorators/skip-org-check.decorator';
import { helperVariable } from 'src/constants/helper';

@SkipOrgCheck()
@Controller('tracking')
@ApiTags('tracking')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TrackingController {
  constructor(private TrackingService: TrackingService) {}

  @Post('updateChapterStatus/:bootcampId/:moduleId')
  @ApiOperation({ summary: 'Update Chapter status' })
  @ApiBearerAuth('JWT-auth')
  @TrackAction({
    action: 'edit_chapter',
    resourceType: 'chapter',
    permissionName: 'editChapter',
    getResourceName: (_result) => {
      return 'Chapter';
    },
  })
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
      chapterId,
    );
    return res;
  }

  @Get('/getAllChaptersWithStatus/:moduleId')
  @ApiOperation({
    summary: 'Get all chapters with status for a user by bootcampId',
  })
  @ApiBearerAuth('JWT-auth')
  async getAllChapterForUser(@Param('moduleId') moduleId: number, @Req() req) {
    const res = await this.TrackingService.getAllChapterWithStatus(
      moduleId,
      req.user[0].id,
    );
    return res;
  }

  @Post('/recomputeAttendance/:batchId')
  @ApiOperation({
    summary: 'Recompute attendance percentage for a batch (testing)',
  })
  @ApiBearerAuth('JWT-auth')
  async recomputeAttendance(@Param('batchId') batchId: number) {
    const res = await this.TrackingService.recomputeBatchAttendancePercentages(
      Number(batchId),
    );
    return res;
  }

  @Post('/reclassifyAttendance/:batchId')
  @ApiOperation({
    summary:
      'Admin-only. Re-derive present/absent for every completed Zoom session in a batch using the current 75%-of-instructor-duration rule, replacing stale records, then refresh the cached percentage. Use once to correct data written before that rule was made consistent across writers.',
  })
  @ApiBearerAuth('JWT-auth')
  async reclassifyAttendance(@Param('batchId') batchId: number, @Req() req) {
    // Deletes and re-derives attendance data for a whole batch — restrict to
    // admins. Checked inline rather than via RolesGuard: this controller's
    // req.user is the array shape set by JwtStrategy ([{ roles, ... }]), not
    // the plain-object shape RolesGuard expects, so RolesGuard would silently
    // deny every caller (including real admins) if applied here.
    const roles = req.user?.[0]?.roles || [];
    if (!roles.includes(helperVariable.admin)) {
      throw new ForbiddenException(
        'Only admins can reclassify attendance for a batch',
      );
    }

    const res =
      await this.TrackingService.reclassifyAndRecomputeBatchAttendance(
        Number(batchId),
      );
    return res;
  }

  @Post('updateQuizAndAssignmentStatus/:bootcampId/:moduleId')
  @ApiOperation({ summary: 'Update Chapter status' })
  @ApiBody({ type: SubmitBodyDto, required: false })
  @ApiBearerAuth('JWT-auth')
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
  @ApiBearerAuth('JWT-auth')
  async getAllModules(@Param('bootcampId') bootcampId: number, @Req() req) {
    const res = await this.TrackingService.getAllModuleByBootcampIdForStudent(
      bootcampId,
      req.user[0].id,
    );
    return res;
  }

  @Get('/bootcampProgress/:bootcampId')
  @ApiOperation({ summary: 'Get bootcamp progress for a user' })
  @ApiBearerAuth('JWT-auth')
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
  @ApiBearerAuth('JWT-auth')
  async getUpcomingAssignment(
    @Param('bootcampId') bootcampId: number,
    @Req() req,
  ) {
    const res = await this.TrackingService.getPendingAssignmentForStudent(
      bootcampId,
      req.user[0].id,
    );
    return res;
  }

  @Get('/allupcomingSubmission')
  @ApiOperation({ summary: 'Get all upcoming assignment submission' })
  @ApiBearerAuth('JWT-auth')
  @ApiQuery({
    name: 'bootcampId',
    type: Number,
    description: 'bootcampId',
    required: false,
  })
  async getAllUpcomingAssignment(
    @Req() req,
    @Query('bootcampId') bootcampId: number,
    @Res() res,
  ) {
    try {
      let [err, success] = await this.TrackingService.getAllUpcomingSubmission(
        req.user[0].id,
        bootcampId,
      );
      if (err) {
        return ErrorResponse.BadRequestException(
          err.message,
          err.statusCode,
        ).send(res);
      }
      return res.status(success.statusCode).json({
        message: success.message,
        code: success.statusCode,
        isSuccess: true,
        mentorshipEnabled: success.mentorshipEnabled ?? false,
        leaderboardEnabled: success.leaderboardEnabled ?? false,

        data: success.data,
      });
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('/getChapterDetailsWithStatus/:chapterId')
  @ApiOperation({
    summary: 'Get chapter details for a user along with status',
  })
  @ApiBearerAuth('JWT-auth')
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
  @ApiBearerAuth('JWT-auth')
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

  @Get('getQuizAndAssignmentWithStatus')
  @ApiOperation({ summary: 'get Quiz And Assignment With Status' })
  @ApiBearerAuth('JWT-auth')
  async getQuizAndAssignmentWithStatus(
    @Req() req,
    @Query('chapterId') chapterId: number,
    @Res() res,
  ) {
    try {
      let [err, success] =
        await this.TrackingService.getQuizAndAssignmentWithStatus(
          req.user[0].id,
          chapterId,
        );
      if (err) {
        return ErrorResponse.BadRequestException(
          err.message,
          err.statusCode,
        ).send(res);
      }
      return res.status(success.statusCode).json({
        message: success.message,
        code: success.statusCode,
        isSuccess: true,
        mentorshipEnabled: success.mentorshipEnabled ?? false,
        leaderboardEnabled: success.leaderboardEnabled ?? false,

        data: success.data,
      });
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Post('updateProject/:projectId')
  @ApiOperation({ summary: 'Update project for a user' })
  @ApiBearerAuth('JWT-auth')
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
    @Body() submitProject: UpdateProjectDto,
  ) {
    const res = await this.TrackingService.submitProjectForAUser(
      req.user[0].id,
      bootcampId,
      moduleId,
      projectId,
      submitProject,
    );
    return res;
  }

  @Get('/getProjectDetailsWithStatus/:projectId/:moduleId')
  @ApiOperation({
    summary: 'Get project details details for a user along with status',
  })
  @ApiBearerAuth('JWT-auth')
  async getProjectDetailsForUser(
    @Param('projectId') projectId: number,
    @Param('moduleId') moduleId: number,
    @Req() req,
    @Res() res,
  ) {
    try {
      let [err, success] =
        await this.TrackingService.getProjectDetailsWithStatus(
          projectId,
          moduleId,
          req.user[0].id,
        );
      if (err) {
        return ErrorResponse.BadRequestException(
          err.message,
          err.statusCode,
        ).send(res);
      }
      return new SuccessResponse(
        success.message,
        success.statusCode,
        success.data,
      ).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('/allBootcampProgress')
  @ApiOperation({
    summary: 'Get all bootcamp progress for a particular student',
  })
  @ApiBearerAuth('JWT-auth')
  async getAllBootcampProgressForStudents(@Req() req) {
    const res = await this.TrackingService.allBootcampProgressForStudents(
      req.user[0].id,
    );
    return res;
  }

  @Get('/latestUpdatedCourse')
  @ApiOperation({
    summary: 'Get all bootcamp progress for a particular student',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiQuery({
    name: 'bootcampId',
    required: true,
    type: Number,
    description: 'bootcampId',
  })
  async getLatestUpdatedCourseForStudent(
    @Req() req,
    @Res() res,
    @Query('bootcampId') bootcampId: number,
  ) {
    try {
      let [err, success] =
        await this.TrackingService.getLatestUpdatedCourseForStudents(
          req.user[0].id,
          bootcampId,
        );
      if (err) {
        return ErrorResponse.BadRequestException(
          err.message,
          err.statusCode,
        ).send(res);
      }
      return res.status(success.statusCode).json({
        message: success.message,
        code: success.statusCode,
        isSuccess: true,
        mentorshipEnabled: success.mentorshipEnabled ?? false,
        leaderboardEnabled: success.leaderboardEnabled ?? false,
        data: success.data,
      });
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('assessment/submissionId=:submissionId')
  @ApiOperation({ summary: 'Get assessment submission by submissionId' })
  @ApiBearerAuth('JWT-auth')
  @ApiQuery({
    name: 'studentId',
    required: false,
    type: Number,
    description: 'studentId of the assessment',
  })
  async getAssessmentSubmission(
    @Param('submissionId') submissionId: number,
    @Req() req,
    @Query('studentId') userId: number,
  ) {
    if (!userId) {
      userId = req.user[0].id;
    }
    const res = await this.TrackingService.getAssessmentSubmission(
      submissionId,
      userId,
    );
    return res;
  }

  @Post('updateFormStatus/:bootcampId/:moduleId')
  @ApiOperation({ summary: 'Update Chapter status' })
  @ApiBody({ type: SubmitFormBodyDto, required: false })
  @ApiBearerAuth('JWT-auth')
  async updateFormStatus(
    @Param('bootcampId') bootcampId: number,
    @Req() req,
    @Param('moduleId') moduleId: number,
    @Query('chapterId') chapterId: number,
    @Body() submitFormBody: SubmitFormBodyDto,
  ) {
    const res = await this.TrackingService.updateFormStatus(
      req.user[0].id,
      moduleId,
      chapterId,
      bootcampId,
      submitFormBody,
    );
    return res;
  }

  @Get('getAllFormsWithStatus/:moduleId')
  @ApiOperation({ summary: 'get All Form Questions With Status' })
  @ApiBearerAuth('JWT-auth')
  async getAllFormsWithStatus(
    @Req() req,
    @Param('moduleId') moduleId: number,
    @Query('chapterId') chapterId: number,
  ) {
    const res = await this.TrackingService.getAllFormsWithStatus(
      req.user[0].id,
      moduleId,
      chapterId,
    );
    return res;
  }

  @Get('/assessment/properting/:assessment_submission_id')
  @ApiBearerAuth('JWT-auth')
  async getProperting(
    @Param('assessment_submission_id') assessmentSubmissionId: number,
    @Res() res,
  ) {
    try {
      let [err, success] = await this.TrackingService.getProperting(
        assessmentSubmissionId,
      );
      if (err) {
        return ErrorResponse.BadRequestException(
          err.message,
          err.statusCode,
        ).send(res);
      }
      return new SuccessResponse(
        success.message,
        success.statusCode,
        success.data,
      ).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }
}
