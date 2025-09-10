import { Module } from '@nestjs/common';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';
import { AuthModule } from 'src/auth/auth.module';
import { JwtService } from '@nestjs/jwt';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [AuthModule],
  controllers: [RbacController],
  providers: [RbacService, JwtService, PermissionsGuard],
  exports: [RbacService, PermissionsGuard]
})
export class RbacModule {}