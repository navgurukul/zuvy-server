import { Controller, Get, Post, Put, Delete, Patch, Body, Param, ValidationPipe, UsePipes, BadRequestException, Query, Req } from '@nestjs/common';
import { StudentService } from './student.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { get } from 'http';
// import { CreateDto, ScheduleDto, CreateLiveBroadcastDto } from './dto/Student.dto';
// import { AuthGuard } from '@nestjs/passport'; // Assuming JWT authentication


@Controller('student')
@ApiTags('student')
@ApiCookieAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
// @UseGuards(AuthGuard('cookie'))
export class StudentController {
  constructor(private studentService: StudentService) { }

  @Get('/')
  @ApiOperation({ summary: 'Get all course enrolled by student' })
  @ApiBearerAuth()
  async getAllStudents(@Req() req): Promise<object> {
    const [err, res] = await this.studentService.enrollData(req.user[0].id);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/bootcamp/search')
  @ApiOperation({ summary: 'Get Public bootcamp by searching' })
  @ApiBearerAuth()
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
  @ApiBearerAuth()
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
  @ApiBearerAuth()
  async removingStudents(
    @Param('userId') userId: number,
    @Param('bootcampId') bootcampId: number,
  ): Promise<object> {
    const [err, res] = await this.studentService.removingStudent(
      userId,
      bootcampId,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }
  
  @Get('/Dashboard/classes/:batch_id')
  @ApiOperation({ summary: 'Get dashboard upcoming class' })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'batch_id',
    required: false,
    type: String,
    description: 'batch_id',
  })
  async getUpcomingClass( @Req() req, @Query('batch_id') batchID: number
  ){
    return  await this.studentService.getUpcomingClass(req.user[0].id,batchID);
  }

  @Get('/Dashboard/attendance')
  @ApiOperation({ summary: 'Get dashboard Attendance.' })
  @ApiBearerAuth()
  async getAttendanceClass( @Req() req
  ){
    return  await this.studentService.getAttendanceClass(req.user[0].id);
  }
}