import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { GenerateResponseDto } from './dto/generate-response.dto';
import { GoogleGenAI } from '@google/genai';
import { deepseekResponse } from './providers/deepseek';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly ai: GoogleGenAI;
  constructor() {
    const key = process.env.GOOGLE_GENAI_API_KEY;
    if (!key)
      throw new InternalServerErrorException(
        'Missing GOOGLE_GENAI_API_KEY for Llm module',
      );
    this.ai = new GoogleGenAI({ apiKey: key });
  }

  async generate(generateResponseDto: GenerateResponseDto) {
    const prompt = generateResponseDto.systemPrompt.trim();
    if (!prompt)
      throw new BadRequestException('systemPrompt must be a non-empty string');

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
      });

      return (
        (response as any).text ??
        (response as any).outputs?.[0]?.content?.text ??
        ''
      );
    } catch (err) {
      this.logger.error(
        'Google genai failed, falling back to DeepSeek:',
        err.message,
      );

      try {
        const fallback = await deepseekResponse(prompt);
        return fallback;
      } catch (fallbackErr) {
        throw new InternalServerErrorException(
          `Both Gemini and DeepSeek failed. Gemini error: ${
            err instanceof Error ? err.message : String(err)
          }, DeepSeek error: ${
            fallbackErr instanceof Error
              ? fallbackErr.message
              : String(fallbackErr)
          }`,
        );
      }
    }
  }
}
