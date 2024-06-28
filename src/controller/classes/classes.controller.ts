import { Controller, Get, Post, Put, Delete, Patch, Body, Param, ValidationPipe, UsePipes, Res, Req, Query, BadRequestException } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { CreateDto, ScheduleDto, CreateLiveBroadcastDto, reloadDto  } from './dto/classes.dto';
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
    @Query('email') email: string) {
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

  @Delete('/:id')
  @ApiOperation({ summary: 'Delete the meeting' })
  @ApiBearerAuth()
  deleteMeetingById(@Param('id') id: number): Promise<object> {
    return this.classesService.deleteMeetingById(id);
  }


  @Get('/getAttendance/:meetingId')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the google class attendance by meetingId" })
  async extractMeetAttendance(@Req() req, @Param('meetingId') meetingId: string): Promise<object> {

    const [err, values] = await this.classesService.getAttendance(meetingId, req.user[0]);
    if (err) {
      throw new BadRequestException(err);
    }
    return values;
  }

  @Get('/getAllAttendance/:batchId')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the google all classes attendance by batchID" })
  extractMeetAttendanceByBatch(@Req() req, @Param('batchId') batchId: string): Promise<object> {

    return this.classesService.getAttendanceByBatchId(batchId, req.user);
  }
  // @Get('/meetingAttendance')
  // @ApiBearerAuth()
  // @ApiOperation({ summary: "Get the google all classes attendance by batchID" })
  // meetingAttendance(){
  //   return this.classesService.meetingAttendance();
  // }

  @Get('/analytics/:meetingId')
  @ApiBearerAuth()
  @ApiOperation({ summary: "meeting attendance analytics with meeting link" })
  async meetingAttendanceAnalytics(@Req() req, @Param('meetingId') meetingId: string) {
    const [err, values] = await this.classesService.meetingAttendanceAnalytics(meetingId, req.user[0]);
    if (err) {
      throw new BadRequestException(err);
    }
    return values;
  }

  @Post('/analytics/reload')
  @ApiBearerAuth()
  @ApiOperation({ summary: "meeting attendance analytics with meeting link" })
  async meetingAttendanceRefress(@Req() req, @Body() reloadData: reloadDto) {
    let meetingIds: Array<any> = reloadData?.meetingIds;

    let attachment = meetingIds.map( async(meetId) => {
      const [err, values] = await this.classesService.getAttendance(meetId, req.user[0]);
    });
    return { message: 'Data Refreshed', status: 200, };
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
    return this.classesService.getClassesByBatchId(batchId, limit, offset);
  }

  // @Get('/getClassesByBootcampId/:bootcampId')
  // @ApiOperation({ summary: 'Get the google classes by bootcampId' })
  // @ApiQuery({
  //   name: 'limit',
  //   required: false,
  //   type: Number,
  //   description: 'Number of classes per page',
  // })
  // @ApiQuery({
  //   name: 'offset',
  //   required: false,
  //   type: Number,
  //   description: 'Offset for pagination',
  // })
  // @ApiBearerAuth()
  // getClassesByBootcampId(
  //   @Query('limit') limit: number,
  //   @Query('offset') offset: number,
  //   @Param('bootcampId') bootcampId: string,
  // ): Promise<object> {
  //   return this.classesService.getClassesByBootcampId(bootcampId, limit,
  //     offset);
  // }

  @Get('/getAttendeesByMeetingId/:id')
  @ApiOperation({ summary: 'Get the google class attendees by meetingId' })
  @ApiBearerAuth()
  getAttendeesByMeetingId(@Param('id') id: number): Promise<object> {
    return this.classesService.getAttendeesByMeetingId(id);
  }

  // @Post('/seeding/table')
  // @ApiOperation({ summary: 'Get the google class attendees by meetingId' })
  // @ApiBearerAuth()
  // async seedingClass(): Promise<object> {
  //   return await this.classesService.seedingClass();
  // }

  
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
    const userId =  parseInt(req.user[0].id);
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
}
