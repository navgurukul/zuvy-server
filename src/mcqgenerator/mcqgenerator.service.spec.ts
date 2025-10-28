import { Test, TestingModule } from '@nestjs/testing';
import { McqgeneratorService } from './mcqgenerator.service';

describe('McqgeneratorService', () => {
  let service: McqgeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [McqgeneratorService],
    }).compile();

    service = module.get<McqgeneratorService>(McqgeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
