// src/content/content.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { JwtService } from '@nestjs/jwt';
import { SseService } from '../../services/sse.service';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    MulterModule.register({
      storage: memoryStorage(),
       limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const isImage = file.mimetype.startsWith('image/');
        const isPdf   = file.mimetype === 'application/pdf';
        cb(null, isImage || isPdf);
      },
    }),
  ],
  controllers: [ContentController],
  providers: [ContentService, JwtService, SseService],
  exports: [ContentService]
})
export class ContentModule {}
