import { Module } from '@nestjs/common';
import { UserTokensService } from './user-tokens.service';

@Module({
  providers: [UserTokensService],
  exports: [UserTokensService],
})
export class UserTokensModule {}
