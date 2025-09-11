import { Module } from '@nestjs/common';
import { RbacController } from './rbac.controller';
import { RbacUserService } from './rbac.user.service';
import { RbacPermissionService } from './rbac.permission.service';
import { AuthModule } from 'src/auth/auth.module';
import { JwtService } from '@nestjs/jwt';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [AuthModule],
  controllers: [RbacController],
  providers: [RbacUserService, RbacPermissionService, JwtService, PermissionsGuard],
  exports: [RbacUserService, RbacPermissionService, PermissionsGuard]
})
export class RbacModule {}