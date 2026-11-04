import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { and, eq, inArray, lt } from 'drizzle-orm';
import { db } from 'src/db';
import { questionIndexOutbox } from 'drizzle/schema';

const OUTBOX_QUEUE = 'question-index-outbox';
const INDEX_QUEUE = 'question-index';
const POLL_JOB_NAME = 'poll-outbox';
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;

@Processor(OUTBOX_QUEUE)
export class QuestionIndexOutboxProcessor extends WorkerHost {
  private readonly logger = new Logger(QuestionIndexOutboxProcessor.name);

  constructor(@InjectQueue(INDEX_QUEUE) private readonly indexQueue: Queue) {
    super();
  }

  override async process(job: Job): Promise<void> {
    if (job.name !== POLL_JOB_NAME) {
      this.logger.warn(`Unknown job name ${job.name} on ${OUTBOX_QUEUE}`);
      return;
    }
    await this.pollAndEnqueue();
  }

  private async pollAndEnqueue(): Promise<void> {
    const pending = await db
      .select({
        id: questionIndexOutbox.id,
        questionId: questionIndexOutbox.questionId,
        requestedByUserId: questionIndexOutbox.requestedByUserId,
        attempts: questionIndexOutbox.attempts,
      })
      .from(questionIndexOutbox)
      .where(
        and(
          inArray(questionIndexOutbox.status, [
            'pending',
            'failed',
            'processing',
          ]),
          lt(questionIndexOutbox.attempts, MAX_ATTEMPTS),
        ),
      )
      .limit(BATCH_SIZE);

    if (pending.length === 0) {
      this.logger.debug('No pending question index outbox events to process.');
      return;
    }

    this.logger.log(`Found ${pending.length} outbox events to process.`);

    const now = new Date().toISOString();
    for (const evt of pending) {
      await db
        .update(questionIndexOutbox)
        .set({
          status: 'processing',
          attempts: evt.attempts + 1,
          updatedAt: now,
        } as any)
        .where(eq(questionIndexOutbox.id, evt.id));
    }

    const questionIds = pending.map((p) => p.questionId);
    const requestedByUserIds = [
      ...new Set(
        pending
          .map((p) => p.requestedByUserId)
          .filter((id): id is string => id != null && id !== ''),
      ),
    ];

    await this.indexQueue.add(
      'index-questions',
      { questionIds, requestedByUserIds },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5_000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Enqueued index-questions job for ${questionIds.length} questions.`,
    );
  }
}
