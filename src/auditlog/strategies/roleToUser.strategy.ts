// src/modules/auditlog/strategies/assign-role-to-user.strategy.ts
import { Injectable } from '@nestjs/common';
import { IAuditStrategy } from './strategy.interface';
@Injectable()
export class AssignRoleToUserStrategy implements IAuditStrategy<any> {
  async execute(dto: any): Promise<void> { /* TODO: write audit for role -> user */ }
}
