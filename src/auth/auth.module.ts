// // auth.module.ts
// import { Module } from '@nestjs/common';
// import { AuthService } from './auth.service';
// import { AuthController } from './auth.controller';
// import { UsersModule } from '../users/users.module';
// import { PassportModule } from '@nestjs/passport';
// import { JwtModule } from '@nestjs/jwt';
// import { jwtConstants } from './constants';
// import { JwtStrategy } from './jwt.strategy';

import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { UserTokensModule } from 'src/user-tokens/user-tokens.module';
let { GOOGLE_CLIENT_ID, GOOGLE_SECRET, GOOGLE_REDIRECT, JWT_SECRET_KEY } =
  process.env;
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: JWT_SECRET_KEY,
      signOptions: { expiresIn: '24h' },
    }),
    UserTokensModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}
// //
