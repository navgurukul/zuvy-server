import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { AuditlogService } from './auditlog.service';
import { AuditResponseDto, CreateAuditlogDto } from './dto/create-auditlog.dto';
import { UpdateAuditlogDto } from './dto/update-auditlog.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags("Audit Log")
@Controller('auditlog')
export class AuditlogController {
  constructor(private readonly auditlogService: AuditlogService) { }

  @Post()
  @ApiOperation({ summary: 'Create Audit log' })
  @ApiBody({
    type: CreateAuditlogDto,
    description: 'Audit data to create'
  })
  @ApiResponse({
    status: 201,
    description: 'Audit created successfully',
    type: AuditResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data or resource not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async createAudit(@Body() createAuditlogDto: CreateAuditlogDto) : Promise<any> {
    return this.auditlogService.createAudit(createAuditlogDto);
  }

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
  async getAllAudit(
      @Query('limit') limit,
      @Query('offset') offset,) {
    return this.auditlogService.getAllAudit(Number(limit) || 10, Number(offset) || 0);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auditlogService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAuditlogDto: UpdateAuditlogDto) {
    return this.auditlogService.update(+id, updateAuditlogDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.auditlogService.remove(+id);
  }
}
