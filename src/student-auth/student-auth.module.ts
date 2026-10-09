import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from 'src/auth/auth.module';
import { CaptchaService } from './captcha.service';
import { StudentAuthController } from './student-auth.controller';
import { StudentAuthService } from './student-auth.service';
import { studentAuthThrottlerOptions } from './student-auth.throttle';

@Module({
  imports: [
    AuthModule,
    // Limits only apply where ThrottlerGuard is attached: the Student ID
    // sign-up and login routes. No other route in the app is throttled.
    ThrottlerModule.forRoot(studentAuthThrottlerOptions()),
  ],
  controllers: [StudentAuthController],
  providers: [StudentAuthService, CaptchaService],
})
export class StudentAuthModule {}
