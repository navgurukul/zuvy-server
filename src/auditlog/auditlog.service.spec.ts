import { Test, TestingModule } from '@nestjs/testing';
import { AuditlogService } from './auditlog.service';
import { AssignPermToRoleStrategy } from './strategies/permToRole.strategy';
import { AssignRoleToUserStrategy } from './strategies/roleToUser.strategy';

describe('AuditlogService', () => {
  let service: AuditlogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditlogService,
        AssignPermToRoleStrategy,
        AssignRoleToUserStrategy,
      ],
    }).compile();

    service = module.get<AuditlogService>(AuditlogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
