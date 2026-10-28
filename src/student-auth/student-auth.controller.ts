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
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { TrackAction } from 'src/trackinglog/decorators/track-action.decorator';
import { TrackActionInterceptor } from 'src/trackinglog/interceptors/track-action.interceptor';
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
 * (access_token, refresh_token, sessionId, showTooltip, user) plus the
 * studentId and school;
 * /auth/refresh and /auth/logout work unchanged.
 */
@ApiTags('Student ID Authentication')
@Controller('auth/student')
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
  @Post('signup')
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ [LOGIN_PER_15_MINUTES]: true })
  @ApiOperation({
    summary:
      'Sign up without email (name + password + state, city, school + captcha)',
    description:
      'Creates the student and returns a generated Student ID plus the same tokens as Google login. State and city come from the GET /schools dropdowns. School: send udiseCode for a school picked from GET /schools, or, if the school is not listed, leave udiseCode out and send schoolName as the student typed it (saved with no UDISE code; the session ID then has NUDISE in place of the code). If both are sent, udiseCode is used. Show the Student ID to the student prominently: it is their login.',
  })
  @ApiResponse({ status: 201, description: 'Account created and signed in' })
  @ApiResponse({
    status: 400,
    description:
      'Invalid input, no school given, school not found / not in that state and city, unknown state or city, or captcha failed',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many sign-ups from this network (per-IP ceiling)',
  })
  async signup(@Req() req, @Body() dto: StudentSignupDto) {
    return this.studentAuthService.signup({
      name: dto.name,
      password: dto.password,
      state: dto.state,
      city: dto.city,
      udiseCode: dto.udiseCode,
      schoolName: dto.schoolName,
      captchaToken: dto.captchaToken,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }

  @Public()
  @Post('login')
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
  async login(@Req() req, @Body() dto: StudentLoginDto) {
    return this.studentAuthService.login(dto.studentId, dto.password, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
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
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'enroll_student',
    resourceType: 'bootcamp',
    permissionName: 'createStudent',
    displayType: 'the student',
    getResourceName: (result, params) => {
      const studentId = result?.data?.studentId || params?.studentId || '';
      const bootcampName = result?.data?.bootcampName || '';
      return bootcampName
        ? `${studentId} in the bootcamp ${bootcampName}`
        : studentId;
    },
  })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Super admin, or admin/ops of the course organisation: enrol a Student ID account in a course or batch',
    description:
      'For private courses. Public courses enrol students automatically when they open them. Admins and ops can only enrol into courses of the organisation they are currently logged into; super admins into any course.',
  })
  @ApiResponse({ status: 200, description: 'Enrolled, or moved to the batch' })
  @ApiResponse({
    status: 403,
    description:
      "Not a super admin, or not admin/ops of the course's organisation",
  })
  async enroll(@Req() req, @Body() dto: EnrollStudentByIdDto) {
    return this.studentAuthService.enrollStudent(
      { userId: Number(req.user[0].id), orgId: req.user[0]?.orgId ?? null },
      dto.studentId,
      dto.bootcampId,
      dto.batchId,
    );
  }
}
