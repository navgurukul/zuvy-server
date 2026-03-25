import {
  Controller,
  Get,
  Req,
  Res,
  Query,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { GoogleService } from './google.service';
import { Public } from 'src/auth/decorators/public.decorator';
import * as jwt from 'jsonwebtoken';

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
  async connect(
    @Query('token') token: string,
    @Query('redirectUrl') redirectUrl: string,
    @Res() res,
  ) {
    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    const payload: any = jwt.verify(token, process.env.JWT_SECRET_KEY);

    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    const userId = payload.sub;

    const url = await this.googleService.generateConnectUrl(
      userId,
      redirectUrl,
    );

    return res.redirect(url);
  }

  /*
  Google OAuth callback
  */
  @Public()
  @Get('callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res,
  ) {
    const result = await this.googleService.handleCallback(code, state);

    let redirectUrl = result.redirectUrl;

    if (!redirectUrl?.startsWith(process.env.ZUVY_BASH_URL)) {
      redirectUrl = `${process.env.ZUVY_BASH_URL}/dashboard`;
    }

    return res.redirect(redirectUrl);
  }
}
