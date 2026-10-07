import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  QuestionsByLlmService,
  QuestionGenerationJob,
} from './questions-by-llm.service';

@Processor('llm-generation')
export class QuestionsGenerationProcessor extends WorkerHost {
  constructor(private readonly questionsService: QuestionsByLlmService) {
    super();
  }

  override async process(job: Job<QuestionGenerationJob>): Promise<void> {
    if (job.name !== 'generate-topic-batch') {
      throw new Error(`Unknown question generation job: ${job.name}`);
    }

    await this.questionsService.processGenerationJob(job.data);
  }
}
