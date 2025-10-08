import { Injectable } from '@nestjs/common';
import { CreateAuditlogDto } from './dto/create-auditlog.dto';
import { UpdateAuditlogDto } from './dto/update-auditlog.dto';

@Injectable()
export class AuditlogService {
  create(createAuditlogDto: CreateAuditlogDto) {
    return 'This action adds a new auditlog';
  }

  findAll() {
    return `This action returns all auditlog`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auditlog`;
  }

  update(id: number, updateAuditlogDto: UpdateAuditlogDto) {
    return `This action updates a #${id} auditlog`;
  }

  remove(id: number) {
    return `This action removes a #${id} auditlog`;
  }
}
