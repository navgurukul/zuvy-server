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
    ApiCookieAuth,
    ApiQuery,
  } from '@nestjs/swagger';
  import { ApiBearerAuth } from '@nestjs/swagger';
  import { difficulty, questionType } from 'drizzle/schema';
  import { ClassesService } from '../classes/classes.service';
  
  @Controller('Instructor')
  @ApiTags('Instructor')
  @ApiCookieAuth()
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  // @UseGuards(AuthGuard('cookie'))
  export class InstructorController {
    constructor(private instructorService: InstructorService) { }


  }