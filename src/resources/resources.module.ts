import { Module } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { ResourcesController } from './resources.controller';
import { AuthModule } from 'src/auth/auth.module';
import { RbacModule } from 'src/rbac/rbac.module';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [ResourcesController],
  providers: [ResourcesService],
})
export class ResourcesModule {}
