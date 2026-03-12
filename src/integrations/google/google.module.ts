import { Module } from '@nestjs/common';
import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { GoogleCalendarService } from './google-calendar.service';

@Module({
  controllers: [GoogleController],
  providers: [GoogleService, GoogleCalendarService],
  exports: [GoogleCalendarService],
})
export class GoogleModule {}
