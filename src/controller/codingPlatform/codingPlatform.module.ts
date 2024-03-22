import { Module ,NestModule,MiddlewareConsumer} from '@nestjs/common';
import { CodingPlatformController } from './codingPlatform.controller';
import { CodingPlatformService } from './codingPlatform.service';

@Module({
    controllers: [CodingPlatformController],
    providers: [CodingPlatformService],
    // imports: [BatchesModule],
    // exports: [BootcampService]
})
export class CodingPlatformModule{
    
}