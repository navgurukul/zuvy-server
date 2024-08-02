import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    ValidationPipe,
    UsePipes,
    Optional,
    Query,
    BadRequestException,
    Req
  } from '@nestjs/common';
  import { InstructorService } from './instructor.service';
  import {
    ApiTags,
    ApiBody,
    ApiOperation,
    ApiQuery,
  } from '@nestjs/swagger';
  import { ApiBearerAuth } from '@nestjs/swagger';
  import { difficulty, questionType } from 'drizzle/schema';
  import { ClassesService } from '../classes/classes.service';
  
  @Controller('instructor')
  @ApiTags('instructor')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  export class InstructorController {
    constructor(private instructorService: InstructorService) { }

    @Get('/allCourses')
    @ApiOperation({ summary: 'Get all courses of a particular instructor' })
    @ApiBearerAuth()
    async getAllCoursesOfInstructor(@Req() req) {
      const res = await this.instructorService.allCourses(req.user[0].id);
      return res;
    }
  }