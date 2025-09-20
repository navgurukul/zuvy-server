import { Controller, Get, Post, Put, Delete, Patch, Body, Param, ValidationPipe, UsePipes, BadRequestException, Query, Req, Res } from '@nestjs/common';
import { StudentService } from './student.service';
import { ApiTags, ApiBody, ApiOperation, ApiQuery, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { get } from 'http';
import { Response } from 'express';
import { ErrorResponse, SuccessResponse } from 'src/errorHandler/handler';
import { ApplyFormData } from './dto/student.dto'
import { Public } from '../../auth/decorators/public.decorator';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('student')
@ApiTags('student')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class StudentController {
  constructor(private studentService: StudentService) { }

  @Get('/')
  @ApiOperation({ summary: 'Get all course enrolled by student' })
  @ApiBearerAuth('JWT-auth')
  @ApiQuery({
    name: 'limit',
    type: Number,
    description: 'Number of items per page',
    required: false
  })
  @ApiQuery({
    name: 'offset',
    type: Number,
    description: 'Offset for pagination',
    required: false
  })
  async getAllStudents(
    @Req() req,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ): Promise<object> {
    const [err, res] = await this.studentService.enrollData(req.user[0].id, limit, offset);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/bootcamp/search')
  @ApiOperation({ summary: 'Get Public bootcamp by searching' })
  @ApiBearerAuth('JWT-auth')
  @ApiQuery({
    name: 'searchTerm',
    required: true,
    type: String,
    description: 'Search by name in bootcamps',
  })
  async getPublicBootcamp(
    @Query('searchTerm') searchTerm: string,
  ): Promise<object> {
    const [err, res] =
      await this.studentService.searchPublicBootcampByStudent(searchTerm);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/bootcamp/public')
  @ApiOperation({ summary: 'Get all Public Bootcamp' })
  @ApiBearerAuth('JWT-auth')
  async getPublicBootcamps(
  ): Promise<object> {
    const [err, res] =
      await this.studentService.getPublicBootcamp();
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }


  @Delete('/:userId/:bootcampId')
  @ApiOperation({ summary: 'Removing student from bootcamp' })
  @ApiBearerAuth('JWT-auth')
  @ApiQuery({
    name: 'userId',
    required: true,
    type: [Number],
    description: 'userId',
  })
  async removingStudents(
    @Query('userId') userId: number | number[],
    @Param('bootcampId') bootcampId: number,
  ): Promise<object> {
    const userIds = Array.isArray(userId) ? userId : [userId]; // Ensure userIds is always an array of numbers
    const [err, res] = await this.studentService.removingStudent(
      userIds,
      bootcampId,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }


  @Get('/Dashboard/classes')
  @ApiOperation({ summary: 'Get dashboard upcoming class' })
  @ApiBearerAuth('JWT-auth')
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
  @ApiQuery({
    name: 'batch_id',
    required: false,
    type: String,
    description: 'batch_id',
  })
  async getUpcomingClass(@Req() req, @Query('batch_id') batchID: number, @Query('limit') limit: number,
    @Query('offset') offset: number, @Res() res: Response
  ) {
    try {
      const [err, success] = await this.studentService.getUpcomingClass(req.user[0].id, batchID, limit, offset);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('/UpcomingEvents')
  @ApiOperation({ summary: 'Get upcoming events  for next 7 days including classes and assessments' })
  @ApiBearerAuth('JWT-auth')
  @ApiQuery({
    name: 'limit',
    type: Number,
    description: 'Number of events per page',
    required: false
  })
  @ApiQuery({
    name: 'offset',
    type: Number,
    description: 'Offset for pagination',
    required: false
  })
  @ApiQuery({
    name: 'bootcampId',
    type: Number,
    description: 'upcoming events of a particular bootcamp',
    required: false
  })
  async getUpcomingEvents(
    @Req() req,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('bootcampId') bootcampId: number,
    @Res() res: Response
  ) {
    try {
      const [err, success] = await this.studentService.getUpcomingEvents(req.user[0].id, limit, offset, bootcampId);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('/Dashboard/attendance')
  @ApiOperation({ summary: 'Get dashboard Attendance.' })
  @ApiBearerAuth('JWT-auth')
  async getAttendanceClass(@Req() req
  ) {
    return await this.studentService.getAttendanceClass(req.user[0].id);
  }

  @Get('/bootcamp/:bootcampId/completed-classes')
  @ApiOperation({ summary: 'Get completed classes with attendance for a bootcamp' })
  @ApiBearerAuth('JWT-auth')
  @ApiQuery({
    name: 'limit',
    type: Number,
    description: 'Number of items per page',
    required: false
  })
  @ApiQuery({
    name: 'offset',
    type: Number,
    description: 'Offset for pagination',
    required: false
  })
  async getCompletedClassesWithAttendance(
    @Req() req,
    @Param('bootcampId') bootcampId: number,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('status') status: string,
    @Query('searchTerm') searchTerm: string,
    @Res() res: Response
  ) {
    try {
      const parsedLimit = limit ? Number(limit) : null;
      const parsedOffset = offset ? Number(offset) : null;
      const [err, success] = await this.studentService.getCompletedClassesWithAttendance(
        req.user[0].id,
        bootcampId,
        parsedLimit,
        parsedOffset,
        status,
        searchTerm,
      );
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      const result: any = success;
      return new SuccessResponse(result.message, result.statusCode, result.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }


  @Get('/leaderboard/:bootcampId')
  @ApiOperation({ summary: 'Get the leaderboard of a course' })
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
  @ApiBearerAuth('JWT-auth')
  async getleaderboardDetails(
    @Param('bootcampId') bootcampId: number,
    @Query('limit') limit: number,
    @Query('offset') offset: number
  ): Promise<object> {
    const res = await this.studentService.getLeaderBoardDetailByBootcamp(
      bootcampId, limit, offset
    );
    return res;
  }

  @Public()
  @Post('/apply')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'student can apply for the course' })
  async getCodingQuestion(@Res() res: Response, @Body() applyFormData: ApplyFormData): Promise<any> {
    try {
      const [err, success] = await this.studentService.updateSpreadsheet(applyFormData);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }


  @Post('assessment/request-reattempt')
  @ApiOperation({ summary: 'Request re-attempt for an assessment submission' })
  @ApiBearerAuth('JWT-auth')
  async requestReattempt(
    @Query('assessmentSubmissionId') assessmentSubmissionId: number,
    @Query('userId') userId: number,
    @Req() req,
    @Res() res: Response
  ): Promise<any> {
    try {
      let [err, success] = await this.studentService.requestReattempt(assessmentSubmissionId, userId);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('/syllabus/:bootcampId')
  @ApiOperation({ summary: 'Get course syllabus with modules and chapters' })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({
    name: 'bootcampId',
    type: Number,
    description: 'Bootcamp ID',
    required: true
  })
  async getCourseSyllabus(
    @Req() req,
    @Param('bootcampId') bootcampId: number,
    @Res() res: Response
  ): Promise<any> {
    try {
      const [err, success] = await this.studentService.getCourseSyllabus(req.user[0].id, bootcampId);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }
}