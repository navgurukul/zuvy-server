import { Controller, Get, Post, Put, Patch, Delete, Body, Param, ValidationPipe, UsePipes, Optional, Query, BadRequestException, Req } from '@nestjs/common';
import { AdminAccessService } from './adminAccess.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Request } from '@nestjs/common';
import { query } from 'express';

@Controller('adminAccess')
@ApiTags('adminAccess')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
export class AdminAccessController {
  constructor(private adminAccessService: AdminAccessService) { }


  @Get('/getAllUsersWithBatchesAndBootcamps')
  @ApiOperation({ summary: 'Fetch all users assigned to batches along with bootcamp IDs' })
  @ApiQuery({
    name: 'batch_id',
    required: false,
    type: Number,
    description: 'batch id',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of students per page',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Offset for pagination',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search by name or email',
  })
  @ApiQuery({
    name: 'dateFilter',
    required: false,
    type: Number,
    description: 'Filter students by their joining date relative to the current date',
  })
  @ApiBearerAuth()
  async getAllUsersWithBatchesAndBootcamps(
    @Query('batch_id') batch_id: number,
    @Query('searchTerm') searchTerm: string,
    @Query('dateFilter') dateFilter: string = '0',
    @Query('limit') limit: number,
    @Query('offset') offset: number,
  ) {
    try {
      const dateFilterNumber = parseInt(dateFilter, 10);

      // Validate dateFilter
      if (isNaN(dateFilterNumber)) {
        throw new BadRequestException('Invalid dateFilter value');
      }

      const result = await this.adminAccessService.getAllUsersWithBatchesAndBootcamps(
        batch_id,
        searchTerm,
        dateFilterNumber,
        limit,
        offset,
      );
      return result;
    } catch (error) {
      throw new BadRequestException('Failed to fetch users with batches and bootcamps');
    }
  }

  @Delete('/getAllUsersWithBatchesAndBootcamps/deleteStudent')
  @ApiOperation({ summary: 'Removing student from bootcamp' })
  @ApiBearerAuth()
  async removeStudentInfo(
    @Query('userId') userId: number,
    @Query('batchId') batchId: number,
    @Query('bootcampId') bootcampId: number,
  ): Promise<object> {
    const [err, res] = await this.adminAccessService.removeStudentInfo(
      userId,
      batchId,
      bootcampId,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/getUserInfo/:userId')
  @ApiOperation({ summary: 'Fetch User Info By userId' })
  @ApiBearerAuth()
  async getUserInfoById(
    @Param('userId') userId: number,) {

    try {
      const result = await this.adminAccessService.getUserInfoById(userId);
      return result;
    } catch (error) {
      throw new BadRequestException('Failed to fetch users info by Id');
    }
  }


}