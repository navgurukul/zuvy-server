import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { RbacModule } from 'src/rbac/rbac.module';
import { PermissionsAllocationService } from './permissions.alloc.service';
import { AuditlogModule } from 'src/auditlog/auditlog.module';
import { AuthModule } from 'src/auth/auth.module';
import { UserTokensModule } from 'src/user-tokens/user-tokens.module';

@Module({
  imports: [AuditlogModule, AuthModule, UserTokensModule],
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionsAllocationService],
  exports: [PermissionsAllocationService],
})
export class PermissionsModule {}
