import { Module } from '@nestjs/common';
import { BootcampModule } from './modules/bootcamp/bootcamp.module';
import { BootcampController } from './modules/bootcamp/bootcamp.controller';
import { BootcampService } from './modules/bootcamp/bootcamp.service';
import { ConfigModule } from '@nestjs/config';
@Module({
  imports: [ConfigModule.forRoot(), BootcampModule],
  controllers: [ BootcampController],
  providers: [ BootcampService],
})
export class AppModule {
  
}
