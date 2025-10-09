import { Module } from '@nestjs/common';
import { AuditlogService } from './auditlog.service';
import { AuditlogController } from './auditlog.controller';
import { AssignPermToRoleStrategy } from './strategies/permToRole.strategy';
import { AssignRoleToUserStrategy } from './strategies/roleToUser.strategy';

@Module({
  controllers: [AuditlogController],
  providers: [
    AuditlogService,
    AssignPermToRoleStrategy,
    AssignRoleToUserStrategy,
  ],
  exports: [AuditlogService],
})
export class AuditlogModule {}
