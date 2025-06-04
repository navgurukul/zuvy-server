import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleOauthGuard } from './guards/google-oauth.guard';
import GoogleJwtResponseDto from './dto/google.jwt.response';

interface RequestWithUser extends Request {
  user: {
    email: string;
    id: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(GoogleOauthGuard)
  async auth() {}

  @Get('google/callback')
  @UseGuards(GoogleOauthGuard)
  async googleAuthRedirect(@Req() req: RequestWithUser, @Res() res: Response) {
    const jwt = await this.authService.login(req.user);

    const responseDto: GoogleJwtResponseDto = GoogleJwtResponseDto.parseJwt(jwt);
    const email: string = req.user.email;
    const isExistingUser: boolean = await this.authService.isExistingUserEmail(email);

    if (!isExistingUser) {
      res.redirect(
        `${process.env.FRONTEND_URL}/unsuccessful?msg=UserNotExists`,
      );
    }

    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwt}`);
  }
}
