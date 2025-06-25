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
    Res,
    ParseArrayPipe,
    UseGuards
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
import { ErrorResponse, SuccessResponse } from 'src/errorHandler/handler';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
  
  @Controller('instructor')
  @ApiTags('instructor')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  export class InstructorController {
    constructor(private instructorService: InstructorService) { }

    @Get('/allCourses')
    @ApiOperation({ summary: 'Get all courses of a particular instructor' })
    @ApiBearerAuth('JWT-auth')
    async getAllCoursesOfInstructor(@Req() req,@Res() res) {
      try {
        let [err, success] =await this.instructorService.allCourses(req.user[0].id);
        if (err) {
          return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res)
        }
        return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
      } catch (error) {
        return ErrorResponse.BadRequestException(error.message).send(res);
      }    
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
  @ApiBearerAuth('JWT-auth')
  async getAllUpcomingClasses(
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('timeFrame') timeFrame: string,
    @Query('batchId', new ParseArrayPipe({ items: Number, optional: true })) batchId: number[] = [],
    @Req() req,
    @Res() res
  ){
      try {
        let [err, success] =await this.instructorService.getAllUpcomingClasses(
          req.user[0].id,
          limit,
          offset,
          timeFrame,
          batchId
        );
        if (err) {
          return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res)
        }
        return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
      } catch (error) {
        return ErrorResponse.BadRequestException(error.message).send(res);
      }    
  }
    @Get('/batchOfInstructor')
    @ApiOperation({ summary: 'Get all batches of a particular instructor' })
    @ApiBearerAuth('JWT-auth')
    async getBatchOfInstructor(@Req() req,@Res() res) {
    try {
      let [err, success] =await this.instructorService.getBatchOfInstructor(req.user[0].id);
      if (err) {
        return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res)
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }  
    }

    @Get('/getAllCompletedClasses')
  @ApiOperation({ summary: 'Get all completed classes by instructorId' })
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
    name: 'weeks',
    required: true,
    type: Number,
    description: 'no of weeks',
  })
  @ApiQuery({
    name: 'batchId',
    required: false,
    type: [Number],
    isArray: true,
    description: 'Array of batchIds',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Sort the classes ascending or descending',
  })
  @ApiQuery({
    name: 'searchTitle',
    required: false,
    type: String,
    description: 'Search by title',
  })
  @ApiBearerAuth('JWT-auth')
  async getAllCompletedClasses(
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('weeks') weeks: number,
    @Query('sortBy') sortBy: string,
    @Query('batchId', new ParseArrayPipe({ items: Number, optional: true })) batchId: number[] = [],
    @Query('searchTitle') searchTitle: string,
    @Req() req,
    @Res() res
  ){
      try {
        let [err, success] =await this.instructorService.getAllCompletedClasses(
          req.user[0].id,
          limit,
          offset,
          weeks,
          sortBy,
          batchId,
          searchTitle
        );
        if (err) {
          return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res)
        }
        return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
      } catch (error) {
         return ErrorResponse.BadRequestException(error.message).send(res);
      }    
  }
  }