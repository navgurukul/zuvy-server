import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ZoomLicenseService } from './zoom-license.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Zoom License Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('zoom-license')
export class ZoomLicenseController {
  constructor(private readonly zoomLicenseService: ZoomLicenseService) {}

  @ApiOperation({
    summary: 'Get license assignments for a specific instructor',
  })
  @Get('licenses/:instructorId')
  async getInstructorLicenses(
    @Param('instructorId', ParseIntPipe) instructorId: number,
  ) {
    return await this.zoomLicenseService.getInstructorLicenses(instructorId);
  }

  @ApiOperation({ summary: 'Get overall license usage dashboard' })
  @Get('dashboard')
  async getDashboard() {
    return await this.zoomLicenseService.getDashboard();
  }

  @ApiOperation({ summary: 'Seed initial 6 licenses' })
  @Post('seed')
  async seedLicenses() {
    return await this.zoomLicenseService.seedLicenses();
  }
}
