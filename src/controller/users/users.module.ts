import { Module ,NestModule,MiddlewareConsumer} from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { BatchesModule } from '../batches/batch.module';
import { JwtModule,JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';

@Module({
    controllers: [UsersController],
    providers: [UsersService, JwtService],
})
export class UsersModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(JwtMiddleware).forRoutes('*'); // Apply JwtMiddleware to all routes
    }
}
