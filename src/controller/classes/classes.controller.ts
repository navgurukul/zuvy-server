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
  userTokens,
  zuvyBatches
} from '../../../drizzle/schema';
import { eq, desc, and, sql, ilike } from 'drizzle-orm';

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
  // @ApiBearerAuth('JWT-auth')
  @Public()
  async create(@Body() classData: CreateSessionDto, @Req() req) {
    const userInfo = {
      id: 58083,
      email: "team@zuvy.org",
      roles: ["admin"]
    };

    // Fetch batch to get bootcampId
    const batchData = await db.select().from(zuvyBatches).where(eq(zuvyBatches.id, classData.batchId)).limit(1);
    if (!batchData.length) {
      throw new BadRequestException('Batch not found');
    }
    const eventDetails = {
      ...classData,
      bootcampId: batchData[0].bootcampId
    };

    return this.classesService.createSession(eventDetails, userInfo);
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
