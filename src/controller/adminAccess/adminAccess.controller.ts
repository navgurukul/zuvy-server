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

  @Get('/getAllUsersWithBatches')
  @ApiOperation({ summary: 'Fetch all users assigned to batches' })
  @ApiBearerAuth()
  async getUsersWithBatches() {
    try {
      const usersWithBatches = await this.adminAccessService.getUsersWithBatches();
      return usersWithBatches;
    } catch (error) {
      throw new BadRequestException('Failed to fetch users with batches');
    }
  }

}