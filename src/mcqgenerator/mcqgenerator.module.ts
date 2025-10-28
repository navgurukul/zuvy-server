import { Module } from '@nestjs/common';
import { McqgeneratorService } from './mcqgenerator.service';
import { McqgeneratorController } from './mcqgenerator.controller';

@Module({
  controllers: [McqgeneratorController],
  providers: [McqgeneratorService],
})
export class McqgeneratorModule {}
