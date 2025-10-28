import { Test, TestingModule } from '@nestjs/testing';
import { McqgeneratorController } from './mcqgenerator.controller';
import { McqgeneratorService } from './mcqgenerator.service';

describe('McqgeneratorController', () => {
  let controller: McqgeneratorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [McqgeneratorController],
      providers: [McqgeneratorService],
    }).compile();

    controller = module.get<McqgeneratorController>(McqgeneratorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
