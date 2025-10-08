import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AuditlogService } from './auditlog.service';
import { CreateAuditlogDto } from './dto/create-auditlog.dto';
import { UpdateAuditlogDto } from './dto/update-auditlog.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags("Audit Log")
@Controller('auditlog')
export class AuditlogController {
  constructor(private readonly auditlogService: AuditlogService) {}

  @Post()
  create(@Body() createAuditlogDto: CreateAuditlogDto) {
    return this.auditlogService.create(createAuditlogDto);
  }

  @Get()
  findAll() {
    return this.auditlogService.findAll();
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
