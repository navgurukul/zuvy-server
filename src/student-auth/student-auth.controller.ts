import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from 'src/auth/decorators/public.decorator';
import { StudentAuthService } from './student-auth.service';
import {
  LOGIN_PER_15_MINUTES,
  SIGNUP_PER_HOUR,
  SIGNUP_PER_MINUTE,
} from './student-auth.throttle';
import {
  EnrollStudentByIdDto,
  FindStudentsQueryDto,
  ResetStudentPasswordDto,
  StudentLoginDto,
  StudentSignupDto,
} from './dto/student-auth.dto';

/**
 * Student ID + password login for learners without an email address.
 * Sign-up and login return exactly the same session as Google login
 * (access_token, refresh_token, showTooltip, user) plus the studentId;
 * /auth/refresh and /auth/logout work unchanged.
 */
@ApiTags('Student ID Authentication')
@Controller('auth')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
export class StudentAuthController {
  constructor(private readonly studentAuthService: StudentAuthService) {}

  @Public()
  @Post('student/signup')
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ [LOGIN_PER_15_MINUTES]: true })
  @ApiOperation({
    summary: 'Sign up without email (name + password + captcha)',
    description:
      'Creates the student and returns a generated Student ID plus the same tokens as Google login. Show the Student ID to the student prominently: it is their login.',
  })
  @ApiResponse({ status: 201, description: 'Account created and signed in' })
  @ApiResponse({ status: 400, description: 'Invalid input or captcha failed' })
  @ApiResponse({
    status: 429,
    description: 'Too many sign-ups from this network (per-IP ceiling)',
  })
  async signup(@Req() req, @Body() dto: StudentSignupDto) {
    return this.studentAuthService.signup(
      dto.name,
      dto.password,
      dto.captchaToken,
      req.ip,
    );
  }

  @Public()
  @Post('student/login')
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ [SIGNUP_PER_MINUTE]: true, [SIGNUP_PER_HOUR]: true })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with Student ID and password' })
  @ApiResponse({ status: 200, description: 'Signed in' })
  @ApiResponse({ status: 401, description: 'Invalid Student ID or password' })
  @ApiResponse({
    status: 429,
    description:
      'Account locked for 15 minutes after 5 wrong passwords, or too many logins from this network',
  })
  async login(@Body() dto: StudentLoginDto) {
    return this.studentAuthService.login(dto.studentId, dto.password);
  }

  @Post('admin/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Super admin: set or generate a new password for a Student ID',
    description:
      'Returns the new password once so it can be given to the student. Also clears any lockout.',
  })
  async resetPassword(@Req() req, @Body() dto: ResetStudentPasswordDto) {
    return this.studentAuthService.resetPassword(
      Number(req.user[0].id),
      dto.studentId,
      dto.newPassword,
    );
  }

  @Get('admin/students')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Super admin: find Student ID accounts by ID or name',
  })
  async findStudents(@Req() req, @Query() query: FindStudentsQueryDto) {
    return this.studentAuthService.findStudents(Number(req.user[0].id), query);
  }

  @Post('admin/enroll')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Super admin: enrol a Student ID account in a course or batch',
    description:
      'For private courses. Public courses enrol students automatically when they open them.',
  })
  async enroll(@Req() req, @Body() dto: EnrollStudentByIdDto) {
    return this.studentAuthService.enrollStudent(
      Number(req.user[0].id),
      dto.studentId,
      dto.bootcampId,
      dto.batchId,
    );
  }
}
