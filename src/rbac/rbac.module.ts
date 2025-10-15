import { Module, forwardRef } from '@nestjs/common';
import { RbacController } from './rbac.controller';
import { RbacPermissionService } from './rbac.permission.service';
import { RbacAllocPermsService } from './rbac.alloc-perms.service';
import { RbacResourcesService } from './rbac.resources.service';
import { AuthModule } from 'src/auth/auth.module';
import { JwtService } from '@nestjs/jwt';
import { PermissionsGuard } from './guards/permissions.guard';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { RbacService } from './rbac.service';

@Module({
  imports: [AuthModule, forwardRef(() => PermissionsModule)],
  controllers: [RbacController],
  providers: [RbacPermissionService, RbacAllocPermsService, JwtService, PermissionsGuard, RbacResourcesService, RbacService],
  exports: [RbacPermissionService, RbacAllocPermsService, PermissionsGuard, RbacResourcesService, RbacService],
})
export class RbacModule { }