import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from 'src/auth/auth.module';
import { SchoolsModule } from 'src/schools/schools.module';
import { TrackinglogModule } from 'src/trackinglog/trackinglog.module';
import { CaptchaService } from './captcha.service';
import { StudentAuthController } from './student-auth.controller';
import { StudentAuthService } from './student-auth.service';
import { studentAuthThrottlerOptions } from './student-auth.throttle';

@Module({
  imports: [
    AuthModule,
    // The school list checked at sign-up.
    SchoolsModule,
    // Enrolment by Student ID is recorded in the org activity log.
    TrackinglogModule,
    // Limits only apply where ThrottlerGuard is attached: the Student ID
    // sign-up and login routes. No other route in the app is throttled.
    ThrottlerModule.forRoot(studentAuthThrottlerOptions()),
  ],
  controllers: [StudentAuthController],
  providers: [StudentAuthService, CaptchaService],
})
export class StudentAuthModule {}
