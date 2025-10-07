import { Module ,NestModule,MiddlewareConsumer} from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { BatchesModule } from '../batches/batch.module';
import { JwtModule,JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
import { AuthModule } from 'src/auth/auth.module';
import { RbacModule } from 'src/rbac/rbac.module';

@Module({
    imports: [AuthModule, RbacModule],
    controllers: [UsersController],
    providers: [UsersService, JwtService],
    exports: [UsersService],
})
export class UsersModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(JwtMiddleware).forRoutes('*'); // Apply JwtMiddleware to all routes
    }
}
