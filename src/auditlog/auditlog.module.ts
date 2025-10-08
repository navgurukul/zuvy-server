import { Module } from '@nestjs/common';
import { AuditlogService } from './auditlog.service';
import { AuditlogController } from './auditlog.controller';

@Module({
  controllers: [AuditlogController],
  providers: [AuditlogService],
})
export class AuditlogModule {}
