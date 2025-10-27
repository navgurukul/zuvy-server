import { Test, TestingModule } from '@nestjs/testing';
import { UserTokensService } from './user-tokens.service';

describe('UserTokensService', () => {
  let service: UserTokensService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserTokensService],
    }).compile();

    service = module.get<UserTokensService>(UserTokensService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
