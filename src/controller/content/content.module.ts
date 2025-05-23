// src/content/content.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    MulterModule.register({
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        cb(null, file.mimetype === 'application/pdf');
      },
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    }),
  ],
  controllers: [ContentController],
  providers: [ContentService, JwtService],
})
export class ContentModule {}
