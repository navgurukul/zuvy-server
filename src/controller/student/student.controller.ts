import { Controller, Get, Post, Put, Delete, Patch, Body, Param, ValidationPipe, UsePipes, BadRequestException, Query } from '@nestjs/common';
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

  @Get('/:userId')
  @ApiOperation({ summary: 'Get all course enrolled by student' })
  @ApiBearerAuth()
  async getAllStudents(@Param('userId') userId: number): Promise<object> {
    const [err, res] = await this.studentService.enrollData(userId);
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
}