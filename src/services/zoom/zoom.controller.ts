import { Body, Controller, Post, Get, Param, UseGuards, UsePipes, ValidationPipe, Patch, Delete, Query } from '@nestjs/common';
import { ZoomService } from './zoom.service';
import { Roles } from '../../decorators/roles.decorator';
import { RolesGuard } from '../../guards/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateZoomUserDto, SetZoomLicenseDto, UpdateZoomUserDto, CreateZoomMeetingDto, UpdateZoomMeetingDto, ZoomEmailDto } from './dto/zoom.dto';

@Controller('zoom')
@ApiTags('zoom')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ZoomController {
  constructor(private readonly zoomService: ZoomService) {}

  @Post('user/ensure-licensed')
  @Roles('admin')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ensure a Zoom user exists & is licensed' })
  async ensureLicensed(@Body() body: CreateZoomUserDto) {
    return this.zoomService.ensureLicensedUser(
      body.email,
      body.firstName,
      body.lastName,
    );
  }

  @Get('user/:email')
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Fetch a Zoom user profile' })
  async getUser(@Param('email') email: string) {
    return this.zoomService.getUser(email);
  }

  @Post('user/license')
  @Roles('admin')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Set/Update a Zoom user license type (1=Basic 2=Licensed 3=On-Prem)' })
  async setLicense(@Body() body: SetZoomLicenseDto) {
    return this.zoomService.setUserLicense(body.email, body.type);
  }

  @Post('user/downgrade')
  @Roles('admin')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Downgrade a Zoom user to Basic (type=1)' })
  async downgrade(@Body() body: ZoomEmailDto) {
    return this.zoomService.downgradeUser(body.email);
  }

  @Patch('user')
  @Roles('admin')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Patch/Update a Zoom user profile or license' })
  async patchUser(@Body() body: UpdateZoomUserDto) {
    return this.zoomService.updateUser(body);
  }

  /* Meeting CRUD */
  @Post('meetings')
  @Roles('admin')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a Zoom meeting (hosted by team account)' })
  async createMeeting(@Body() body: CreateZoomMeetingDto) {
    const meetingReq = {
      topic: body.topic,
      agenda: body.agenda || '',
      start_time: body.start_time,
      duration: body.duration,
      timezone: body.timezone || 'UTC',
      type: body.type || 2,
      settings: {
        auto_recording: body.settings?.auto_recording || 'cloud',
        host_video: body.settings?.host_video ?? true,
        participant_video: body.settings?.participant_video ?? true,
        join_before_host: body.settings?.join_before_host ?? false,
        mute_upon_entry: body.settings?.mute_upon_entry ?? true,
        waiting_room: body.settings?.waiting_room ?? false,
        audio: body.settings?.audio || 'both',
        attendance_reporting: body.settings?.attendance_reporting ?? true,
        alternative_hosts_email_notification: body.settings?.alternative_hosts_email_notification ?? false,
        alternative_hosts: body.settings?.alternative_hosts || undefined,
      }
    };
    return this.zoomService.createMeeting(meetingReq as any);
  }

  @Get('meetings')
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List meetings for team host (type param: upcoming, live, scheduled, previous, etc.)' })
  async listMeetings(@Query('type') type = 'upcoming') {
    return this.zoomService.listUserMeetings(type);
  }

  @Get('meetings/:id')
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get meeting details' })
  async getMeeting(@Param('id') id: string) {
    return this.zoomService.getMeeting(id);
  }

  @Patch('meetings/:id')
  @Roles('admin')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a meeting' })
  async updateMeeting(@Param('id') id: string, @Body() body: UpdateZoomMeetingDto) {
    await this.zoomService.updateMeeting(id, body as any);
    return { success: true };
  }

  @Delete('meetings/:id')
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a meeting' })
  async deleteMeeting(@Param('id') id: string) {
    await this.zoomService.deleteMeeting(id);
    return { success: true };
  }

  @Get('meetings/:id/attendance-70')
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Compute attendance (70% rule) & recordings for one or multiple Zoom meetings (comma-separated IDs, no DB write)' })
  async attendance70(@Param('id') meetingIdParam: string) {
    const ids = meetingIdParam.includes(',')
      ? meetingIdParam.split(',').map(s => s.trim()).filter(Boolean)
      : meetingIdParam;
    return this.zoomService.computeAttendanceAndRecordings70(ids as any);
  }
}
