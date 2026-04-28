import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { AddSuperAdminDto } from './dto/super-admin.dto';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';

@ApiTags('Super Admin')
@Controller('super-admin')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Post()
  @ApiOperation({ summary: 'Add a new Super Admin' })
  @ApiBody({ type: AddSuperAdminDto })
  async addSuperAdmin(@Body() addSuperAdminDto: AddSuperAdminDto) {
    return this.superAdminService.addSuperAdmin(addSuperAdminDto.email);
  }

  @Delete(':id')
  async removeSuperAdmin(@Param('id') userId: number) {
    return this.superAdminService.removeSuperAdmin(userId);
  }

  @Get()
  async getAllSuperAdmins() {
    return this.superAdminService.getAllSuperAdmins();
  }

  @Put(':id')
  async updateSuperAdmin(@Param('id') userId: number, @Body() data: any) {
    return this.superAdminService.updateSuperAdmin(userId, data);
  }
}
