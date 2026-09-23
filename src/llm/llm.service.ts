import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { GenerateResponseDto } from './dto/generate-response.dto';
import { GoogleGenAI } from '@google/genai';
import { deepseekResponse } from './providers/deepseek';
import { OpenAIProvider } from './providers/openai';
import { CircuitBreaker } from './utils/circuit-breaker';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly ai: GoogleGenAI;
  private primary: OpenAIProvider;
  private primaryBreaker: CircuitBreaker;
  private fallbackBreaker: CircuitBreaker;

  constructor() {
    this.primary = new OpenAIProvider();
    this.primaryBreaker = new CircuitBreaker('OpenAI', {
      failureThreshold: 5,
      resetTimeout: 30000,
      monitorWindow: 60000,
    });
    this.fallbackBreaker = new CircuitBreaker('GenAI', {
      failureThreshold: 3,
      resetTimeout: 45000,
      monitorWindow: 60000,
    });

    const key = process.env.GOOGLE_GENAI_API_KEY;
    if (!key)
      throw new InternalServerErrorException(
        'Missing GOOGLE_GENAI_API_KEY for Llm module',
      );
    this.ai = new GoogleGenAI({ apiKey: key });
  }

  async generate(generateResponseDto: GenerateResponseDto) {
    const prompt = generateResponseDto.systemPrompt.trim();
    if (!prompt) {
      this.logger.error('systemPrompt is empty', prompt);
      throw new BadRequestException('systemPrompt must be a non-empty string');
    }
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
        this.logger.error('DeepSeek fallback also failed:', fallbackErr);
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

  async generateCompletion(prompt: string) {
    try {
      if (!this.primaryBreaker.isOpen()) {
        try {
          const result = await this.executeWithRetry(
            () => this.primary.completion(prompt),
            'primary',
          );
          this.primaryBreaker.recordSuccess();
          return { ...result, provider: 'openai' };
        } catch (error) {
          this.primaryBreaker.recordFailure();
          this.logger.warn(`Primary provider failed: ${error.message}`);
        }
      } else {
        this.logger.warn(
          'Primary circuit breaker is OPEN, skipping to fallback',
        );
      }

      if (!this.fallbackBreaker.isOpen()) {
        try {
          const text = await this.generate({ systemPrompt: prompt });
          this.fallbackBreaker.recordSuccess();
          return {
            text,
            usage: null,
            latencyMs: 0,
            provider: 'genai',
          };
        } catch (error) {
          this.fallbackBreaker.recordFailure();
          this.logger.error(`Fallback provider failed: ${error.message}`);
          throw new Error('All LLM providers are unavailable');
        }
      }

      throw new Error('All providers circuit breakers are open');
    } catch (error) {
      this.logger.error('Error generating response from llm: ', error);
    }
  }

  private async executeWithRetry(
    fn: () => Promise<any>,
    providerType: 'primary' | 'fallback',
  ) {
    const maxRetries = providerType === 'primary' ? 2 : 1;
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries && this.isRetryable(error)) {
          const delay = this.getBackoffDelay(attempt);
          this.logger.debug(
            `Retry ${attempt + 1}/${maxRetries} after ${delay}ms`,
          );
          await this.sleep(delay);
          continue;
        }
        throw lastError;
      }
    }
  }

  private isRetryable(error: any): boolean {
    const retryableStatuses = [408, 429, 421, 500, 502, 503, 504];
    return !error.status || retryableStatuses.includes(error.status);
  }

  private getBackoffDelay(attempt: number): number {
    const baseDelay = 1000 * Math.pow(2, attempt);
    const jitter = Math.random() * 500;
    return Math.min(baseDelay + jitter, 5000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
