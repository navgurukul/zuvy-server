import { Controller, Get, Post, Put, Delete, Patch, Body, Param, ValidationPipe, UsePipes, Res, Req } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { CreateDto, ScheduleDto, CreateLiveBroadcastDto } from './dto/classes.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
// import { AuthGuard } from '@nestjs/passport'; // Assuming JWT authentication


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
// @UseGuards(AuthGuard('cookie'))
export class ClassesController {
  constructor(private classesService: ClassesService) {}

  @Get('/')
  @ApiOperation({ summary: 'Google authenticate' })
  async googleAuth(@Res() res) {
    return this.classesService.googleAuthentication(res);
  }

  @Get('/redirect')
  @ApiOperation({ summary: 'Google authentication redirect' })
  @ApiBearerAuth()
  async googleAuthRedirect(@Req() request) {
    return this.classesService.googleAuthenticationRedirect(request);
  }

  @Post('/')
  @ApiOperation({ summary: 'Create the new class' })
  @ApiBearerAuth()
  async create(@Body() classData: CreateLiveBroadcastDto) {
    return this.classesService.createLiveBroadcast(classData);
  }
  @Get('/getClassesByBatchId/:batchId')
  @ApiOperation({ summary: 'Get the google classes by batchId' })
  @ApiBearerAuth()
  getClassesByBatchId(@Param('batchId') batchId: string): Promise<object> {
    return this.classesService.getClassesByBatchId(batchId);
  }
  @Get('/getClassesByBootcampId/:bootcampId')
  @ApiOperation({ summary: 'Get the google classes by bootcampId' })
  @ApiBearerAuth()
  getClassesByBootcampId(
    @Param('bootcampId') bootcampId: string,
  ): Promise<object> {
    return this.classesService.getClassesByBootcampId(bootcampId);
  }
  @Get('/getAttendeesByMeetingId/:id')
  @ApiOperation({ summary: 'Get the google class attendees by meetingId' })
  @ApiBearerAuth()
  getAttendeesByMeetingId(@Param('id') id: number): Promise<object> {
    return this.classesService.getAttendeesByMeetingId(id);
  }
  // @Get('/:id')
  // @ApiOperation({ summary: "getting meeting By id" })
  // getMeetingById(@Param('id') id: number): Promise<object> {
  //     return this.classesService.getMeetingById(id);
  // }

  @Get('/getEventDetails')
  @ApiOperation({ summary: 'getting event details' })
  @ApiBearerAuth()
  getEventDetails(@Res() res): Promise<object> {
    return this.classesService.getEventDetails(res);
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Delete the meeting' })
  @ApiBearerAuth()
  deleteMeetingById(@Param('id') id: number): Promise<object> {
    return this.classesService.deleteMeetingById(id);
  }

    // @Get('/getAttendance')
    // @ApiOperation({ summary: "Get meeting Attendance" })
    // extractMeetAttendance(@Res() res): Promise<object> {
    //     return this.classesService.getAttendance();
    // }
    @Get('/getAttendance/:meetingId')
    @ApiOperation({ summary: "Get the google class attendance by meetingId" })
    extractMeetAttendance(@Param('meetingId') meetingId: string): Promise<object> {
        return this.classesService.getAttendance(meetingId);
    }


    // @Patch('/:id')
    // @ApiOperation({ summary: "Patch the meeting details" })
    // updateMeetingById(@Param('id') id: number, @Body() classData: CreateLiveBroadcastDto) {
    //     return this.classesService.updateMeetingById(id, classData);
    // }
}
