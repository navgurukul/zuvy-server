import { Controller, Get, Post, Put, Delete, Patch, Body, Param, ValidationPipe, UsePipes, Res, Req ,Query} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { CreateDto, ScheduleDto, CreateLiveBroadcastDto } from './dto/classes.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Cron } from '@nestjs/schedule';


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
  constructor(private classesService: ClassesService) { }

  @Get('/')
  @ApiOperation({ summary: 'Google authenticate' })
  async googleAuth(@Res() res, 
  @Query('userID') userId: number,
  @Query('email') email: string ) {
    return this.classesService.googleAuthentication(res, email, userId);
  }

  @Get('/redirect')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Google authentication redirect' })
  async googleAuthRedirect(@Req() request,
  ) {
    return this.classesService.googleAuthenticationRedirect(request, request.user);
  }

  @Post('/')
  @ApiOperation({ summary: 'Create the new class' })
  @ApiBearerAuth()
  async create(@Body() classData: CreateLiveBroadcastDto) {
    return this.classesService.createLiveBroadcast(classData);
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
    @Param('batchId') batchId: string): Promise<object> {
    return this.classesService.getClassesByBatchId(batchId,limit,offset);
  }
  @Get('/getClassesByBootcampId/:bootcampId')
  @ApiOperation({ summary: 'Get the google classes by bootcampId' })
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
  getClassesByBootcampId(
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Param('bootcampId') bootcampId: string,
  ): Promise<object> {
    return this.classesService.getClassesByBootcampId(bootcampId,limit,
      offset);
  }
  @Get('/getAttendeesByMeetingId/:id')
  @ApiOperation({ summary: 'Get the google class attendees by meetingId' })
  @ApiBearerAuth()
  getAttendeesByMeetingId(@Param('id') id: number): Promise<object> {
    return this.classesService.getAttendeesByMeetingId(id);
  }
  @Cron('*/3 * * * *')
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


  @Get('/getAttendance/:meetingId')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the google class attendance by meetingId" })
  extractMeetAttendance(@Req() req,@Param('meetingId') meetingId: string): Promise<object> {
    return this.classesService.getAttendance(meetingId,req.user[0]);
  }

  @Get('/getAllAttendance/:batchId')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the google all classes attendance by batchID" })
  extractMeetAttendanceByBatch(@Req() req,@Param('batchId') batchId: string): Promise<object> {

    return this.classesService.getAttendanceByBatchId(batchId, req.user);
  }
  @Get('/meetingAttendance')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the google all classes attendance by batchID" })
  meetingAttendance(){
    return this.classesService.meetingAttendance();
  }
}
