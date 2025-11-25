import { PartialType } from '@nestjs/swagger';
import { CreateAuditlogDto } from './create-auditlog.dto';

export class UpdateAuditlogDto extends PartialType(CreateAuditlogDto) {}
