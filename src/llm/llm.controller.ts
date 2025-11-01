import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { LlmService } from './llm.service';
import { GenerateResponseDto } from './dto/generate-response.dto';

@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post()
  generateResponse(@Body() generateResponseDto: GenerateResponseDto) {
    return this.llmService.generate(generateResponseDto);
  }
}
