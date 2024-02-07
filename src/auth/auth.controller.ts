// // auth.controller.ts
// import {
//     Controller,
//     Request,
//     Post,
//     UseGuards,
//     Get,
//     Body,
//   } from '@nestjs/common';
//   import { AuthService } from './auth.service';
//   import { LocalAuthGuard } from './local-auth.guard';
//   import { JwtAuthGuard } from './jwt-auth.guard';
//   import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
  
//   @ApiTags('auth') // add swagger tag for auth controller
//   @Controller('auth')
//   export class AuthController {
//     constructor(private authService: AuthService) {}
  
//     @UseGuards(LocalAuthGuard)
//     @Post('login')
//     @ApiBody({ type: LoginDto }) // add swagger body type for login
//     async login(@Request() req) {
//       return this.authService.login(req.user);
//     }
  
//     @UseGuards(JwtAuthGuard)
//     @Get('profile')
//     @ApiBearerAuth() // add swagger bearer auth for profile
//     getProfile(@Request() req) {
//       return req.user;
//     }
//   }
  