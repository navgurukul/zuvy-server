import { Test, TestingModule } from '@nestjs/testing';
import { AuditlogController } from './auditlog.controller';
import { AuditlogService } from './auditlog.service';

describe('AuditlogController', () => {
  let controller: AuditlogController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditlogController],
      providers: [AuditlogService],
    }).compile();

    controller = module.get<AuditlogController>(AuditlogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
