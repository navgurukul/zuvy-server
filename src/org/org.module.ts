import { Module } from '@nestjs/common';
import { OrgService } from './org.service';
import { OrgController } from './org.controller';
import { NotificationModule } from '../notification/notification.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { UserTokensModule } from 'src/user-tokens/user-tokens.module';
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET_KEY || 'secret',
      signOptions: { expiresIn: '1h' },
    }),
    NotificationModule,
    AuthModule,
    UserTokensModule,
  ],
  controllers: [OrgController],
  providers: [OrgService],
})
export class OrgModule {}
