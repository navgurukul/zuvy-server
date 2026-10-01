import { Test, TestingModule } from '@nestjs/testing';
import { QuestionsByLlmController } from './questions-by-llm.controller';
import { QuestionsByLlmService } from './questions-by-llm.service';

describe('QuestionsByLlmController', () => {
  let controller: QuestionsByLlmController;
  let service: QuestionsByLlmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionsByLlmController],
      providers: [
        {
          provide: QuestionsByLlmService,
          useValue: {
            generateQuestions: jest.fn().mockResolvedValue({
              message:
                'Question generation jobs enqueued. You are not blocked.',
              totalJobs: 1,
              jobIds: ['gen-1'],
              orgId: 12,
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<QuestionsByLlmController>(QuestionsByLlmController);
    service = module.get<QuestionsByLlmService>(QuestionsByLlmService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should enqueue generation requests through the service', async () => {
    const payload = {
      topicConfigurations: [
        {
          topicName: 'JavaScript',
          topicDescription: 'Core JS concepts',
          totalQuestions: 2,
        },
      ],
      totalQuestions: 2,
      levelId: 'A',
    };

    const result = await controller.generateQuestions(12, payload as any, {
      user: [{ id: 7 }],
    });

    expect(service.generateQuestions).toHaveBeenCalledWith(payload, 12, 7);
    expect(result).toEqual({
      message: 'Question generation jobs enqueued. You are not blocked.',
      totalJobs: 1,
      jobIds: ['gen-1'],
      orgId: 12,
    });
  });
});
