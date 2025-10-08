import { Module } from '@nestjs/common';
import { AuditlogService } from './auditlog.service';
import { AuditlogController } from './auditlog.controller';
import { AssignPermToRoleStrategy } from './strategies/permtorole.strategy';
import { AssignRoleToUserStrategy } from './strategies/roletouser.strategy';

@Module({
  controllers: [AuditlogController],
  providers: [AuditlogService, AssignPermToRoleStrategy, AssignRoleToUserStrategy],
  exports: [AuditlogService]
})
export class AuditlogModule {}
