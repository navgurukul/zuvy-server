import { Module ,NestModule,MiddlewareConsumer} from '@nestjs/common';
import { BootcampController } from './bootcamp.controller';
import { BootcampService } from './bootcamp.service';
import { BatchesModule } from '../batches/batch.module';
import { JwtModule,JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/token_validation.middleware';

@Module({
    controllers: [BootcampController],
    providers: [BootcampService,JwtService],
    // imports: [BatchesModule],
    // exports: [BootcampService]
})
export class BootcampModule implements NestModule {
       configure(consumer: MiddlewareConsumer) {
        consumer.apply(JwtMiddleware).forRoutes('*'); // Apply JwtMiddleware to all routes
    }
}
