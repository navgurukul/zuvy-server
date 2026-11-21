import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  StreamableFile,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsEmail, IsOptional, Matches } from 'class-validator';
import { AuthService } from 'src/auth/auth.service';
import { AfeReportService } from './afe-report.service';
import { XLSX_CONTENT_TYPE } from './afe-report.excel';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class AfeReportPeriodDto {
  @ApiPropertyOptional({
    example: '2026-11-17',
    description:
      'First day, India time (YYYY-MM-DD). Leave out for "from the start".',
  })
  @IsOptional()
  @Matches(DAY, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-19',
    description:
      'Last day, India time, included (YYYY-MM-DD). Leave out for "until now".',
  })
  @IsOptional()
  @Matches(DAY, { message: 'to must be YYYY-MM-DD' })
  to?: string;
}

export class AfeReportTestEmailDto extends AfeReportPeriodDto {
  @ApiPropertyOptional({
    example: 'you@navgurukul.org',
    description:
      'Send the test to this address. Defaults to your own account email.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}

@ApiTags('AFE Career Tours report')
@Controller('afe-report')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
export class AfeReportController {
  constructor(
    private readonly service: AfeReportService,
    private readonly authService: AuthService,
  ) {}

  private async assertSuperAdmin(req: any) {
    const roles = await this.authService.getUserRoles(
      Number(req.user[0].id),
      null,
    );
    if (!roles.includes('super_admin')) {
      throw new ForbiddenException('Only super admins can use the AFE report');
    }
  }

  @Get('preview')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Super admin: download the AFE Career Tours report for a period',
    description:
      'Builds the same Excel file the 3-day email attaches, for any period. Nothing is emailed or recorded, so the scheduled reports are not affected.',
  })
  @ApiResponse({ status: 200, description: 'The .xlsx file' })
  @ApiResponse({ status: 403, description: 'Not a super admin' })
  async preview(@Req() req, @Query() query: AfeReportPeriodDto) {
    await this.assertSuperAdmin(req);
    const file = await this.service.previewFile(query.from, query.to);
    return new StreamableFile(file.content, {
      type: XLSX_CONTENT_TYPE,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  @Post('send-test')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Super admin: email a test AFE report to one address',
    description:
      'Emails the report for a period to you (or the given address) with "[TEST]" in the subject. Checks that SES can send the attachment. Not recorded; the 3-day schedule is not affected.',
  })
  @ApiResponse({ status: 200, description: 'Sent' })
  @ApiResponse({ status: 403, description: 'Not a super admin' })
  async sendTest(@Req() req, @Body() body: AfeReportTestEmailDto) {
    await this.assertSuperAdmin(req);
    const email = body.email ?? req.user[0].email;
    if (!email) {
      throw new ForbiddenException('Your account has no email; pass "email"');
    }
    return this.service.sendTest(email, body.from, body.to);
  }
}
