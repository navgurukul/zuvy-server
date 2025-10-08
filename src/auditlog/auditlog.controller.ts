import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AuditlogService } from './auditlog.service';
import { AuditResponseDto, CreateAuditlogDto } from './dto/create-auditlog.dto';
import { UpdateAuditlogDto } from './dto/update-auditlog.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

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

  @Get()
  @ApiOperation({ summary: 'Get all Audit log data' })
  @ApiBearerAuth('JWT-auth')
  async getAllAudit() {
    return this.auditlogService.getAllAudit();
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
