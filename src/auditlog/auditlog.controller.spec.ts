import { Test, TestingModule } from '@nestjs/testing';
import { AuditlogController } from './auditlog.controller';
import { AuditlogService } from './auditlog.service';
import { AssignPermToRoleStrategy } from './strategies/permToRole.strategy';
import { AssignRoleToUserStrategy } from './strategies/roleToUser.strategy';

describe('AuditlogController', () => {
  let controller: AuditlogController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditlogController],
      providers: [
        AuditlogService,
        AssignPermToRoleStrategy,
        AssignRoleToUserStrategy,
      ],
    }).compile();

    controller = module.get<AuditlogController>(AuditlogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
