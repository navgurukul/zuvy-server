import { Module ,NestModule,MiddlewareConsumer} from '@nestjs/common';
import { AdminAccessController } from './adminAccess.controller';
import { AdminAccessService } from './adminAccess.service';
import { BatchesModule } from '../batches/batch.module';
import { JwtModule,JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';
import { BootcampModule } from '../bootcamp/bootcamp.module';

@Module({
    controllers: [AdminAccessController],
    providers: [AdminAccessService, JwtService],
    imports: [BootcampModule],
    // exports:[AdminAccessService]
})
export class AdminAccessModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(JwtMiddleware).forRoutes('*'); // Apply JwtMiddleware to all routes
    }
}
