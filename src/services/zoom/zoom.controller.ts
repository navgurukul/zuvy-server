import { Controller, Post, Put, Delete, Get, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { ZoomService } from './zoom.service';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';

export class CreateAndStoreZoomMeetingDto {
  title: string;
  batchId: number;
  bootcampId: number;
  moduleId: number;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
}

export class UpdateMeetingDto {
  topic?: string;
  start_time?: string;
  duration?: number;
  timezone?: string;
}

@Controller('zoom')
@ApiTags('Zoom')
export class ZoomController {
  constructor(private readonly zoomService: ZoomService) {}

  @Public()
  @Post('/create')
  @ApiOperation({ summary: 'Create a new Zoom meeting' })
  async createMeeting(@Body() meetingData: CreateAndStoreZoomMeetingDto) {
    const userInfo = {
      id: 58083,
      email: 'team@zuvy.org',
      roles: ['admin'],
    };

    // Transform the payload to Zoom API format
    const zoomMeetingData = {
      topic: meetingData.title,
      type: 2, // Scheduled meeting
      start_time: meetingData.startDateTime,
      duration: Math.ceil((new Date(meetingData.endDateTime).getTime() - new Date(meetingData.startDateTime).getTime()) / (1000 * 60)), // Duration in minutes
      timezone: meetingData.timeZone,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: false,
        auto_recording: 'cloud'
      }
    };

    try {
      const result = await this.zoomService.createAndStoreZoomMeeting(zoomMeetingData, meetingData, userInfo);
      if (!result.success) {
        throw new BadRequestException(result.error);
      }
      return {
        status: 'success',
        message: 'Zoom meeting created successfully',
        data: result.data,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }

  @Public()
  @Put('/update/:meetingId')
  @ApiOperation({ summary: 'Update an existing Zoom meeting' })
  async updateMeeting(@Param('meetingId') meetingId: string, @Body() meetingData: UpdateMeetingDto) {
    try {
      await this.zoomService.updateMeeting(meetingId, meetingData);
      return {
        status: 'success',
        message: 'Zoom meeting updated successfully',
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }

  @Public()
  @Delete('/delete/:meetingId')
  @ApiOperation({ summary: 'Delete a Zoom meeting' })
  async deleteMeeting(@Param('meetingId') meetingId: string) {
    try {
      await this.zoomService.deleteMeeting(meetingId);
      return {
        status: 'success',
        message: 'Zoom meeting deleted successfully',
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }

  @Public()
  @Get('/get/:meetingId')
  @ApiOperation({ summary: 'Get details of a Zoom meeting' })
  async getMeeting(@Param('meetingId') meetingId: string) {
    try {
      const result = await this.zoomService.getMeeting(meetingId);
      if (!result.success) {
        throw new BadRequestException(result.error);
      }
      return {
        status: 'success',
        message: 'Zoom meeting details fetched successfully',
        data: result.data,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }
}