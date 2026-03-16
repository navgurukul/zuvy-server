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
  async connect(@Query('token') token: string, @Res() res) {
    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    const payload: any = jwt.decode(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }

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
    console.log('Google callback triggered', { code, state });
    return this.googleService.handleCallback(code, state);
  }
}
