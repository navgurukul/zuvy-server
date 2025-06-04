// auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { db } from '../db/index';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';


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

  async isExistingUserEmail(email: string): boolean {
    if (!email) {
      return false;
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user.length == 1;
  }
}
