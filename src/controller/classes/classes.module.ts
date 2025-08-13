import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
import { AuthModule } from 'src/auth/auth.module';
import { ZoomModule } from '../../services/zoom/zoom.module';
import { YoutubeService } from '../../services/youtube.service';

@Module({
    imports: [AuthModule, ZoomModule],
    controllers: [ClassesController],
    providers: [ClassesService, JwtService, YoutubeService],
    exports: [ClassesService]
})
export class ClassesModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(JwtMiddleware).forRoutes('*');
    }
}