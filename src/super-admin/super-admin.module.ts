import { Module } from '@nestjs/common';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { AuthModule } from 'src/auth/auth.module';
import { UserTokensModule } from 'src/user-tokens/user-tokens.module';
@Module({
  imports: [AuthModule, UserTokensModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
