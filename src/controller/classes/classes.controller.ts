import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  ValidationPipe,
  UsePipes,
  Res,
  Req,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import {
  ApiTags,
  ApiBody,
  ApiOperation,
  ApiCookieAuth,
  ApiQuery,
} from '@nestjs/swagger';
import {
  CreateDto,
  ScheduleDto,
  CreateSessionDto,
  reloadDto,
  updateSessionDto,
  DTOsessionRecordViews,
} from './dto/classes.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ErrorResponse, SuccessResponse } from 'src/errorHandler/handler';

// config user for admin
let configUser = { id: process.env.ID, email: process.env.EMAIL };

@Controller('classes')
@ApiTags('classes')
@ApiCookieAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
export class ClassesController {
  constructor(private classesService: ClassesService) {}

  @Get('/')
  @ApiOperation({ summary: 'Google authenticate' })
  async googleAuth(
    @Res() res,
    @Query('userID') userId: number,
    @Query('email') email: string,
  ) {
    return this.classesService.googleAuthentication(res, email, userId);
  }

  @Get('/redirect')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Google authentication redirect' })
  async googleAuthRedirect(@Req() request) {
    return this.classesService.googleAuthenticationRedirect(
      request,
      request.user,
    );
  }

  @Post('/')
  @ApiOperation({ summary: 'Create the new class' })
  @ApiBearerAuth()
  async create(@Body() classData: CreateSessionDto, @Req() req) {
    return this.classesService.createSession(classData, {
      ...configUser,
      roles: req.user[0].roles,
    });
  }

  @Get('/getAttendance/:meetingId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the google class attendance by meetingId' })
  async extractMeetAttendance(
    @Req() req,
    @Param('meetingId') meetingId: string,
  ): Promise<object> {
    const [err, values] = await this.classesService.getAttendance(meetingId, {
      ...configUser,
      roles: req.user[0].roles,
    });
    if (err) {
      throw new BadRequestException(err);
    }
    return values;
  }

  @Get('/getAllAttendance/:batchId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the google all classes attendance by batchID' })
  extractMeetAttendanceByBatch(
    @Req() req,
    @Param('batchId') batchId: string,
  ): Promise<object> {
    return this.classesService.getAttendanceByBatchId(batchId, {
      ...configUser,
      roles: req.user[0].roles,
    });
  }

  @Get('/analytics/:sessionId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'meeting attendance analytics with meeting link' })
  async meetingAttendanceAnalytics(
    @Req() req,
    @Param('sessionId') sessionId: number,
  ) {
    const [err, values] = await this.classesService.meetingAttendanceAnalytics(
      sessionId,
      { ...configUser, roles: req.user[0].roles }
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return values;
  }

  @Post('/analytics/reload')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'meeting attendance analytics with meeting link' })
  async meetingAttendanceRefress(@Req() req, @Body() reloadData: reloadDto) {
    let meetingIds: Array<any> = reloadData?.meetingIds;

    let attachment = meetingIds.map(async (meetId) => {
      const [err, values] = await this.classesService.getAttendance(meetId, {
        ...configUser,
        roles: req.user[0].roles,
      });
    });
    return { message: 'Data Refreshed', status: 200 };
  }

  @Get('/getClassesByBatchId/:batchId')
  @ApiOperation({ summary: 'Get the google classes by batchId' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of classes per page',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Offset for pagination',
  })
  @ApiBearerAuth()
  getClassesByBatchId(
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Param('batchId') batchId: string,
  ): Promise<object> {
    return this.classesService.getClassesByBatchId(batchId, limit, offset);
  }

  @Get('/getAttendeesByMeetingId/:id')
  @ApiOperation({ summary: 'Get the google class attendees by meetingId' })
  @ApiBearerAuth()
  getAttendeesByMeetingId(@Param('id') id: number): Promise<object> {
    return this.classesService.getAttendeesByMeetingId(id);
  }

  @Get('/all/:bootcampId')
  @ApiOperation({ summary: 'Get the students classes by bootcamp and batch' })
  @ApiQuery({
    name: 'offset',
    required: true,
    type: Number,
    description: 'Offset for pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: true,
    type: Number,
    description: 'Number of classes limit per page',
  })
  @ApiQuery({
    name: 'batchId',
    required: false,
    type: Number,
    description: 'batch id',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search by class title',
  })
  @ApiQuery({
    name: 'status',
    required: true,
    type: String,
    description: 'completed, upcoming, ongoing or all',
  })
  @ApiBearerAuth()
  async getClassesBy(
    @Param('bootcampId') bootcampId: number,
    @Query('batchId') batchId: number,
    @Query('status') status: string,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('searchTerm') searchTerm: string,
    @Req() req,
  ): Promise<object> {
    const userId = parseInt(req.user[0].id);
    return this.classesService.getClassesBy(
      bootcampId,
      req.user[0],
      batchId,
      limit,
      offset,
      searchTerm,
      status,
    );
  }
  @Get('/meetings/:bootcampId')
  @ApiOperation({ summary: 'Get the google classes id by bootcampId' })
  @ApiBearerAuth()
  getClassesBybootcampId(
    @Query('bootcampId') bootcampId: string,
  ): Promise<object> {
    return this.classesService.unattendanceClassesByBootcampId(bootcampId);
  }

  @Delete('/delete/:meetingId')
  @ApiOperation({ summary: 'Delete the google class by meetingId' })
  @ApiBearerAuth()
  deleteClassByMeetingId(
    @Param('meetingId') meetingId: string,
    @Req() req,
  ): Promise<object> {
    return this.classesService.deleteSession(meetingId, {
      ...configUser,
      roles: req.user[0].roles,
    });
  }

  @Patch('/update/:meetingId')
  @ApiOperation({ summary: 'Update the google class by meetingId' })
  @ApiBearerAuth()
  updateClassByMeetingId(
    @Param('meetingId') meetingId: string,
    @Body() classData: updateSessionDto,
    @Req() req,
  ): Promise<object> {
    return this.classesService.updateSession(meetingId, classData, {
      ...configUser,
      roles: req.user[0].roles,
    });
  }
  
  @Get('/sessionRecordViews')
  @ApiOperation({ summary: 'Get the session record views with sessionID or userID with both' })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'sessionId',
    required: false,
    type: Number,
    description: 'Session Id is a number type, optional',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'User Id is a number type, optional',
    type: Number,
  })
  async getSessionRecordViews(
    @Query('sessionId') sessionId,
    @Query('userId') userId,
    @Res() res: Response,
  ): Promise<object> {
    try {
      let [err, success] = await this.classesService.getSessionRecordViews(
        sessionId,
        userId,
      );
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
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

  @Post('/sessionRecordViews')
  @ApiOperation({ summary: 'Create the session record views' })
  @ApiBearerAuth()
  async createSessionRecordViews(
    @Body() sessionRecordViews: DTOsessionRecordViews,
    @Req() req,
    @Res() res: Response,
  ): Promise<object> {
    try {
      const userId = parseInt(req.user[0].id);
      let [err, success] = await this.classesService.createSessionRecordViews(
        sessionRecordViews,
        userId
      );
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
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
