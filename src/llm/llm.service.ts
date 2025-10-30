import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { GenerateResponseDto } from './dto/generate-response.dto';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class LlmService {
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
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      return (
        (response as any).text ??
        (response as any).outputs?.[0]?.content?.text ??
        ''
      );
    } catch (err) {
      throw new InternalServerErrorException(
        `LLM call failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
