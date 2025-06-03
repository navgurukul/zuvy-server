// auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface GoogleUser {
  email: string;
  id: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(user: GoogleUser) {
    const payload = { email: user.email, sub: user.id };
    return this.jwtService.sign(payload, {
      expiresIn: '7d',
    });
  }
}
