import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleOauthGuard } from './guards/google-oauth.guard';

interface RequestWithUser extends Request {
  user: {
    email: string;
    id: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('/')
  async dumdum() {
    console.log('====================================');
    console.log(`this is just a slash`);
    console.log('====================================');
  }

  @Get('google')
  @UseGuards(GoogleOauthGuard)
  async auth() {
    console.log('====================================');
    console.log(`Initial auth`);
    console.log('====================================');
  }

  @Get('google/callback')
  @UseGuards(GoogleOauthGuard)
  async googleAuthRedirect(@Req() req: RequestWithUser, @Res() res: Response) {
    console.log('====================================');
    console.log(`Had a callback with ${JSON.stringify(req)}`);
    console.log('====================================');
    const jwt = await this.authService.login(req.user);
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwt}`);
  }
}
