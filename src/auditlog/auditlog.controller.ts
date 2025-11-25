import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { AuditlogService } from './auditlog.service';
import { AuditResponseDto, CreateAuditlogDto } from './dto/create-auditlog.dto';
import { UpdateAuditlogDto } from './dto/update-auditlog.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Audit Log')
@Controller('auditlog')
export class AuditlogController {
  constructor(private readonly auditlogService: AuditlogService) {}

  @Get('/')
  @ApiOperation({ summary: 'Get all Audit log data' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of bootcamps per page',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Offset for pagination',
  })
  @ApiBearerAuth('JWT-auth')
  async getAllAudit(@Query('limit') limit, @Query('offset') offset) {
    return this.auditlogService.getAllAudit(
      Number(limit) || 10,
      Number(offset) || 0,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auditlogService.findOne(+id);
  }
}
