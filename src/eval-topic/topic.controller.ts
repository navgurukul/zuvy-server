import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { resolveOrgId } from 'src/auth/resolve-org-id';
import { CreateTopicDto } from './dto/create-topic.dto';
import { createTopicExample } from './swagger_examples/examples';
import { TopicService } from './topic.service';

@ApiTags('Eval Topic')
@ApiBearerAuth('JWT-auth')
@ApiQuery({
  name: 'orgId',
  required: false,
  type: Number,
  description:
    'Required for super admin (no orgId in token). Other roles use orgId from the JWT.',
})
@UseGuards(JwtAuthGuard)
@Controller('topic')
export class TopicController {
  constructor(private readonly topicService: TopicService) {}

  @Post()
  @ApiOperation({ summary: 'Create a topic' })
  @ApiBody({
    type: CreateTopicDto,
    examples: {
      basicExample: {
        summary: 'Create a new topic',
        value: createTopicExample,
      },
    },
  })
  create(
    @Req() req: Request & { user?: { orgId?: number | string } },
    @Body() createTopicDto: CreateTopicDto,
  ) {
    return this.topicService.create(this.getOrgId(req), createTopicDto);
  }

  @Get()
  @ApiOperation({ summary: 'List topics' })
  findAll(@Req() req: Request & { user?: { orgId?: number | string } }) {
    return this.topicService.findAll(this.getOrgId(req));
  }

  @Get('with-difficulty-levels')
  @ApiOperation({ summary: 'Get topics with difficulty levels' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'id', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  getAllTopicsWithDifficultyLevels(
    @Req() req: Request & { user?: { orgId?: number | string } },
    @Query('search') search?: string,
    @Query('id') id?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.topicService.getAllTopicsWithDifficultyLevels(
      this.getOrgId(req),
      search,
      id != null && id !== '' ? Number(id) : undefined,
      limit != null && limit !== '' ? Number(limit) : undefined,
      offset != null && offset !== '' ? Number(offset) : undefined,
    );
  }

  private getOrgId(
    req: Request & { user?: { orgId?: number | string } },
  ): number {
    return resolveOrgId(req);
  }
}
