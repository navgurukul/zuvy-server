import { Module } from '@nestjs/common';
import { BootcampController } from './bootcamp.controller';
import { BootcampService } from './bootcamp.service';

@Module({
    controllers: [BootcampController],
    providers: [BootcampService],
})
export class BootcampModule {
    
}
