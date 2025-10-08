import { Test, TestingModule } from '@nestjs/testing';
import { AuditlogService } from './auditlog.service';

describe('AuditlogService', () => {
  let service: AuditlogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditlogService],
    }).compile();

    service = module.get<AuditlogService>(AuditlogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
