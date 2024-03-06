import { Module ,NestModule,MiddlewareConsumer} from '@nestjs/common';
import { BootcampController } from './bootcamp.controller';
import { BootcampService } from './bootcamp.service';
import { BatchesModule } from '../batches/batch.module';
import { JwtModule,JwtService } from '@nestjs/jwt';
import { JwtMiddleware } from 'src/middleware/jwt.middleware';

@Module({
    controllers: [BootcampController],
    providers: [BootcampService],
    // imports: [BatchesModule],
    // exports: [BootcampService]
})
export class BootcampModule {
      
}
