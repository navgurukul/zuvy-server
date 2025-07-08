import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { BootcampController } from './bootcamp.controller';
import { BootcampService } from './bootcamp.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
import { AuthModule } from 'src/auth/auth.module';
import { ContentModule } from '../content/content.module';

@Module({
    imports: [AuthModule, ContentModule],
    controllers: [BootcampController],
    providers: [BootcampService, JwtService],
    exports: [BootcampService]
})
export class BootcampModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(JwtMiddleware).forRoutes('*');
    }
}
