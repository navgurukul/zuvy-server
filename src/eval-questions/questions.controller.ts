import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { resolveOrgId } from 'src/auth/resolve-org-id';
import { RolesGuard } from 'src/guards/roles.guard';
import { PermissionsGuard } from 'src/rbac/guards/permissions.guard';
import { QuestionsCrudService } from './questions.crud.service';

@ApiTags('Questions')
@ApiBearerAuth('JWT-auth')
@ApiQuery({
  name: 'orgId',
  required: false,
  type: Number,
  description:
    'Required for super admin (no orgId in token). Other roles use orgId from the JWT.',
})
@Controller('eval/questions')
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
export class QuestionsController {
  constructor(private readonly questionsCrudService: QuestionsCrudService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'difficulty', required: false, type: String })
  @ApiQuery({ name: 'topicName', required: false, type: String })
  findAll(
    @Req() req: Request & { user?: { orgId?: number | string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('difficulty') difficulty?: string,
    @Query('topicName') topicName?: string,
  ) {
    return this.questionsCrudService.findAll({
      orgId: resolveOrgId(req),
      page,
      limit,
      difficulty,
      topicName,
    });
  }
}
