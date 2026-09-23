import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { resolveOrgId } from 'src/auth/resolve-org-id';
import { GenerateQuestionsDto } from './dto/generate-questions.dto';
import { QuestionsService } from './questions.service';
import { generateQuestionsExample } from './swagger_examples/examples';

@ApiTags('Questions')
@ApiBearerAuth('JWT-auth')
@Controller('questions')
export class QuestionsGenerateController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Enqueue background question generation jobs' })
  @ApiBody({
    type: GenerateQuestionsDto,
    examples: generateQuestionsExample,
  })
  async enqueueGeneration(
    @Req() req: Request & { user?: { sub?: string; orgId?: number | string } },
    @Body() payload: GenerateQuestionsDto,
  ) {
    const orgId = resolveOrgId(req);
    const requestedByUserId =
      req.user?.sub != null ? String(req.user.sub) : undefined;
    return this.questionsService.enqueueGeneration(
      payload,
      orgId,
      requestedByUserId,
    );
  }
}
