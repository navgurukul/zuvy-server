import { Controller, Get, Post, Put, Delete, Patch, Body, Param, ValidationPipe, UsePipes, BadRequestException, Query } from '@nestjs/common';
import { StudentService } from './student.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
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
  constructor(private studentService: StudentService) {}

  @Get('/:userId')
  @ApiOperation({ summary: 'Get all course enrolled by student' })
  async getAllStudents(@Param('userId') userId: number): Promise<object> {
    const [err, res] = await this.studentService.enrollData(userId);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/bootcamp/search')
  @ApiOperation({ summary: 'Get Public bootcamp by searching' })
  @ApiQuery({
    name: 'searchTerm',
    required: true,
    type: String,
    description: 'Search by name in bootcamps',
  })
  async getPublicBootcamp(@Query('searchTerm') searchTerm: string): Promise<object> {
    console.log("inside public seraching")
    const [err,res] = await this.studentService.searchPublicBootcampByStudent(searchTerm);
     if (err) {
       throw new BadRequestException(err);
     }
     return res;
  }


  @Delete('/:userId/:bootcampId')
  @ApiOperation({ summary: 'Removing student from bootcamp' })
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
}