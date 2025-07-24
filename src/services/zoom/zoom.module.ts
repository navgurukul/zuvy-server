import { Module } from '@nestjs/common';
import { ZoomController } from './zoom.controller';
import { ZoomService } from './zoom.service';
import { db } from '../../db/index'; // Adjust the import path as necessary
import { zuvySessions } from '../../../drizzle/schema'; // Adjust the path if necessary

@Module({
  controllers: [ZoomController],
  providers: [
    ZoomService,
    {
      provide: 'DATABASE_CONNECTION',
      useValue: db,
    },
    {
      provide: 'ZUVY_SESSIONS_REPOSITORY',
      useValue: zuvySessions,
    },
  ],
  exports: [ZoomService],
})
export class ZoomModule {}