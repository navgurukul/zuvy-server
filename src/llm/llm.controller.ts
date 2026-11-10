import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LlmService } from './llm.service';
import { GenerateResponseDto } from './dto/generate-response.dto';

@ApiTags('llm')
@Controller('llm')
@ApiBearerAuth('JWT-auth')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post()
  generateResponse(@Body() generateResponseDto: GenerateResponseDto) {
    return this.llmService.generate(generateResponseDto);
  }
}
