import { Controller, Get, Req, Res, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { GoogleService } from './google.service';
import { Public } from 'src/auth/decorators/public.decorator';

@ApiTags('Google Integration')
@ApiBearerAuth('JWT-auth')
@Controller('google')
export class GoogleController {
  constructor(private readonly googleService: GoogleService) {}

  /*
  Connect Google Calendar
  */
  @Public()
  @Get('connect')
  async connect(@Query('token') token: string, @Res() res) {
    const payload: any = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString(),
    );

    const userId = payload.sub;

    const url = await this.googleService.generateConnectUrl(userId);

    return res.redirect(url);
  }

  /*
  Google OAuth callback
  */
  @Public()
  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string) {
    return this.googleService.handleCallback(code, state);
  }
}
