import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TrackinglogService } from './trackinglog.service';
import { QueryTrackinglogDto } from './dto/query-trackinglog.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Tracking Log')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('trackinglog')
export class TrackinglogController {
  constructor(private readonly trackinglogService: TrackinglogService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all tracking logs with filtering and pagination',
    description: 'Retrieve tracking logs with optional filters',
  })
  @ApiQuery({
    name: 'orgId',
    required: true,
    type: Number,
    description: 'Organization ID',
  })
  @ApiQuery({
    name: 'actorUserId',
    required: false,
    type: Number,
    description: 'Filter by user who performed the action',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    type: String,
    description:
      'Filter by action type. Use generic verbs (create, edit, delete) or specific actions (create_course, edit_batch)',
    enum: [
      '',
      'create',
      'edit',
      'update',
      'delete',
      'view',
      'login',
      'logout',
      'export',
      'import',
      'assign',
      'publish',
      'archive',
      'enroll',
      'unenroll',
      'mark',
      'reassign',
    ],
  })
  @ApiQuery({
    name: 'role',
    required: false,
    type: String,
    description: 'Filter by user role',
    enum: [
      '',
      'admin',
      'super_admin',
      'instructor',
      'ops_team',
      'support',
      'content',
    ],
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by action status',
    enum: ['', 'success', 'failed', 'pending'],
  })
  @ApiQuery({
    name: 'timeRange',
    required: false,
    type: String,
    description: 'Quick time filter dropdown.',
    enum: ['all', 'today', 'yesterday', 'past7days', 'past30days'],
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description:
      'Full-text search: matches action, resourceType, description or actor name. E.g. "module", "create", "Sarah"',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of records to skip (default: 0)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of items to return (default: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns tracking logs with pagination',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Tracking logs fetched successfully',
        },
        data: {
          type: 'object',
          properties: {
            logs: { type: 'array', items: { type: 'object' } },
            pagination: {
              type: 'object',
              properties: {
                offset: { type: 'number', example: 0 },
                limit: { type: 'number', example: 100 },
                total: { type: 'number', example: 250 },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Non-admin users must provide orgId',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findAll(@Query() query: QueryTrackinglogDto, @Request() req: any) {
    // Clean up query parameters - remove invalid dropdown values
    if (query.action === '--' || query.action === '') {
      query.action = undefined;
    }

    // Extract user role from request (assumes JWT payload contains role)
    const userRole = req.user?.role;
    return this.trackinglogService.findAll(query, userRole);
  }
}
