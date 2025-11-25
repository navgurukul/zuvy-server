import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { RbacModule } from 'src/rbac/rbac.module';
import { PermissionsAllocationService } from './permissions.alloc.service';
import { AuditlogModule } from 'src/auditlog/auditlog.module';

@Module({
  imports: [AuditlogModule],
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionsAllocationService],
  exports: [PermissionsAllocationService]
})
export class PermissionsModule {}
