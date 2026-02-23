import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { CodingPlatformController } from './codingPlatform.controller';
import { CodingPlatformService } from './codingPlatform.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
import { AuthModule } from 'src/auth/auth.module';
import { TrackinglogModule } from 'src/trackinglog/trackinglog.module';

@Module({
  imports: [AuthModule, TrackinglogModule],
  controllers: [CodingPlatformController],
  providers: [CodingPlatformService, JwtService],
  // imports: [BatchesModule],
  // exports: [BootcampService]
})
export class CodingPlatformModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes('*'); // Apply JwtMiddleware to all routes
  }
}
