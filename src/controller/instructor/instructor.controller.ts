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
    Req,
    ParseArrayPipe
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


    @Get('/getAllUpcomingClasses')
  @ApiOperation({ summary: 'Get all upcoming classes by instructorId' })
  @ApiQuery({
    name: 'limit',
    required: true,
    type: Number,
    description: 'Number of classes per page',
  })
  @ApiQuery({
    name: 'offset',
    required: true,
    type: Number,
    description: 'Offset for pagination (min value 1)',
  })
  @ApiQuery({
    name: 'batchId',
    required: false,
    type: [Number],
    isArray: true,
    description: 'Array of batchIds',
  })
  @ApiBearerAuth()
  getAllUpcomingClasses(
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('timeFrame') timeFrame: string,
    @Query('batchId', new ParseArrayPipe({ items: Number, optional: true })) batchId: number[] = [],
    @Req() req
  ): Promise<object> {
    return this.instructorService.getAllUpcomingClasses(
      req.user[0].id,
      limit,
      offset,
      timeFrame,
      batchId
    );
  }
    @Get('/batchOfInstructor')
    @ApiOperation({ summary: 'Get all batches of a particular instructor' })
    @ApiBearerAuth()
    async getBatchOfInstructor(@Req() req) {
    const res = await this.instructorService.getBatchOfInstructor(req.user[0].id);
    return res;
    }
  }