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
  UseGuards,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import {
  ApiTags,
  ApiBody,
  ApiOperation,
  ApiCookieAuth,
  ApiQuery,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  CreateDto,
  ScheduleDto,
  CreateSessionDto,
  reloadDto,
  updateSessionDto,
  DTOsessionRecordViews,
  AddLiveClassesAsChaptersDto,
} from './dto/classes.dto';
import { Response } from 'express';
import { ErrorResponse, SuccessResponse } from 'src/errorHandler/handler';
import { Public } from '../../auth/decorators/public.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { auth2Client } from '../../auth/google-auth';
import { db } from '../../db/index';
import {
  userTokens
} from '../../../drizzle/schema';
import { userInfo } from 'os';

// config user for admin
let configUser = { id: process.env.ID, email: process.env.TEAM_EMAIL };

@Controller('classes')
@ApiTags('classes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
export class ClassesController {
  constructor(private classesService: ClassesService) {}

  @Public()
  @Get('/')
  @ApiOperation({ summary: 'Google authenticate' })
  async googleAuth(
    @Res() res,
    @Query('userID') userId: number,
    @Query('email') email: string,
  ) {
    return this.classesService.googleAuthentication(res, email, userId);
  }

  @Public()
  @Get('/google-auth/redirect')
  @ApiOperation({ summary: 'Handle Google OAuth redirect' })
  async googleAuthRedirect(@Req() request) {
    try {
      const { code, state } = request.query;
      const { tokens } = await auth2Client.getToken(code);
      
      // Parse state to get user info
      const userInfo = JSON.parse(state);
      
      // Store tokens in database
      await db
        .insert(userTokens)
        .values({
          userId: userInfo.id,
          userEmail: userInfo.email,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token
        })
        .onConflictDoUpdate({
          target: [userTokens.userId],
          set: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token
          }
        });

      return {
        status: 'success',
        message: 'Calendar access granted successfully'
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to authenticate with Google Calendar'
      };
    }
  }

  @Post('/')
  @ApiOperation({ summary: 'Create the new class' })
  @ApiBearerAuth('JWT-auth')
  async create(@Body() classData: CreateSessionDto, @Req() req) {
    const userInfo = {
      id: Number(req.user[0].id),
      email: req.user[0].email,
      roles: req.user[0].roles || []
    };
    return this.classesService.createSession(classData, userInfo);
  }

  @Get('/getAttendance/:meetingId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get the google class attendance by meetingId' })
  async extractMeetAttendance(
    @Req() req,
    @Param('meetingId') meetingId: string,
  ): Promise<object> {
    const userInfo = {
      id: Number(req.user[0].id),
      email: req.user[0].email,
      roles: req.user[0].roles || []
    };
    const [err, values] = await this.classesService.getAttendance(meetingId, userInfo);
    if (err) {
      throw new BadRequestException(err);
    }
    return values;
  }

  @Public()
  @Get('/getAllAttendance/:batchId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get the google all classes attendance by batchID' })
  extractMeetAttendanceByBatch(
    @Req() req,
    @Param('batchId') batchId: string,
  ): Promise<object> {
    const userInfo = {
      id: Number(req.user[0].id),
      email: req.user[0].email,
      roles: req.user[0].roles || []
    };
    return this.classesService.getAttendanceByBatchId(batchId, userInfo);
  }
  // @Get('/calculatelogic')
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'calculate attendance logic' })
  // calculateLogic(
  //   @Req() req,
  // ): Promise<object> {
  //   return this.classesService.calculateAttendance([{meetingId:'73bdvrab8kj2tnhahhl57njsis_20250326T143000Z'}],[
  //     { userId: 65521, email: "deepanshu_23se051@dtu.ac.in" },
  //     { userId: 65529, email: "gauravjha_23se063@dtu.ac.in" },
  //     { userId: 65548, email: "shivamsingh70546@gmail.com" },
  //     { userId: 65569, email: "salonikumari_23cs368@dtu.ac.in" },
  //     { userId: 65546, email: "shalvisingh_23it151@dtu.ac.in" },
  //     { userId: 65545, email: "samayjain_23mc128@dtu.ac.in" },
  //     { userId: 65539, email: "rishiraj_23cs343@dtu.ac.in" },
  //     { userId: 65547, email: "shatrughanshukla_23cs391@dtu.ac.in" },
  //     { userId: 65540, email: "rishusingh_23cs345@dtu.ac.in" },
  //     { userId: 65527, email: "divyanshurangad@gmail.com" },
  //     { userId: 65528, email: "faizanraza2308@gmail.com" }
  //   ])
  // }

  @Get('/analytics/:sessionId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'meeting attendance analytics with meeting link' })
  async meetingAttendanceAnalytics(
    @Req() req,
    @Param('sessionId') sessionId: number,
  ) {
    const userInfo = {
      id: Number(req.user[0].id),
      email: req.user[0].email,
      roles: req.user[0].roles || []
    };
    const [err, values] = await this.classesService.meetingAttendanceAnalytics(
      sessionId,userInfo
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return values;
  }

  @Post('/analytics/reload')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'meeting attendance analytics with meeting link' })
  async meetingAttendanceRefress(@Req() req, @Body() reloadData: reloadDto) {
    let meetingIds: Array<any> = reloadData?.meetingIds;

    let attachment = meetingIds.map(async (meetId) => {
      const userInfo = {
      id: Number(req.user[0].id),
      email: req.user[0].email,
      roles: req.user[0].roles || []
    };
      const [err, values] = await this.classesService.getAttendance(meetId, userInfo);
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
  @ApiBearerAuth('JWT-auth')
  getClassesByBatchId(
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Param('batchId') batchId: string,
  ): Promise<object> {
    return this.classesService.getClassesByBatchId(batchId, limit, offset);
  }

  @Get('/getAttendeesByMeetingId/:id')
  @ApiOperation({ summary: 'Get the google class attendees by meetingId' })
  @ApiBearerAuth('JWT-auth')
  getAttendeesByMeetingId(@Param('id') id: string): Promise<object> {
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
  @ApiBearerAuth('JWT-auth')
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
  @ApiBearerAuth('JWT-auth')
  getClassesBybootcampId(
    @Query('bootcampId') bootcampId: string,
  ): Promise<object> {
    return this.classesService.unattendanceClassesByBootcampId(bootcampId);
  }
  
  @Get('/check-calendar-access')
  @ApiOperation({ summary: 'Check if admin has calendar access' })
  @ApiBearerAuth('JWT-auth')
  async checkCalendarAccess(@Req() req) {
    try {
      const userInfo = {
        id: Number(req.user[0].id),
        email: req.user[0].email,
        roles: req.user[0].roles || []
      };
      
      const calendar = await this.classesService.accessOfCalendar(userInfo);
      if ('status' in calendar && calendar.status === 'error') {
        return {
          status: 'not success',
          message: calendar.message
        };
      }
      return {
        status: 'success',
        message: 'Calendar access verified'
      };
    } catch (error) {
      return {
        status: 'not success',
        message: 'Failed to verify calendar access',
        error: error.message
      };
    }
  }



  @Get('/sessions/:id')
  @ApiOperation({ summary: 'Get individual session by ID with role-based access' })
  @ApiBearerAuth('JWT-auth')
  async getSession(@Param('id') sessionId: number, @Req() req) {
    const userInfo = {
      id: Number(req.user[0].id),
      email: req.user[0].email,
      roles: req.user[0].roles || []
    };
    return this.classesService.getSession(sessionId, userInfo);
  }

  @Put('/sessions/:id')
  @ApiOperation({ summary: 'Update session by ID' })
  @ApiBearerAuth('JWT-auth')
  async updateSession(
    @Param('id') sessionId: number,
    @Body() updateData: updateSessionDto,
    @Req() req
  ) {
    const userInfo = {
      id: Number(req.user[0].id),
      email: req.user[0].email,
      roles: req.user[0].roles || []
    };
    return this.classesService.updateSession(sessionId, updateData, userInfo);
  }

  @Delete('/sessions/:id')
  @ApiOperation({ summary: 'Delete session by ID' })
  @ApiBearerAuth('JWT-auth')
  async deleteSession(@Param('id') sessionId: number, @Req() req) {
    const userInfo = {
      id: Number(req.user[0].id),
      email: req.user[0].email,
      roles: req.user[0].roles || []
    };
    return this.classesService.deleteSession(sessionId, userInfo);
  }

  @Post('/sessions/:id/fetch-attendance')
  @ApiOperation({ summary: 'Manually fetch Zoom attendance for a session' })
  @ApiBearerAuth('JWT-auth')
  async fetchSessionAttendance(@Param('id') sessionId: number, @Req() req) {
    const userInfo = {
      id: Number(req.user[0].id),
      email: req.user[0].email,
      roles: req.user[0].roles || []
    };

    // Check admin access
    if (!userInfo.roles?.includes('admin')) {
      throw new BadRequestException('Only admins can fetch attendance data');
    }

    return this.classesService.fetchZoomAttendanceForSession(sessionId);
  }

  @Post('/process-attendance')
  @ApiOperation({ summary: 'Process all completed sessions for attendance (admin only)' })
  @ApiBearerAuth('JWT-auth')
  async processAttendanceForCompletedSessions(@Req() req) {
    const userInfo = {
      id: Number(req.user[0].id),
      email: req.user[0].email,
      roles: req.user[0].roles || []
    };

    // Check admin access
    if (!userInfo.roles?.includes('admin')) {
      throw new BadRequestException('Only admins can process attendance data');
    }

    return this.classesService.processCompletedSessionsForAttendance();
  }
}
