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
    required: false,
    type: Number,
    description: 'Organization ID (optional)',
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
      'Filter by action type. Use generic verbs (create, update, delete) or specific actions (create_course, edit_batch)',
    enum: [
      '',
      // Generic action verbs - will match all actions starting with this verb
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
      // Or use specific actions
      'create_course',
      'edit_course',
      'delete_course',
      'create_bootcamp',
      'edit_bootcamp',
      'delete_bootcamp',
      'create_batch',
      'edit_batch',
      'delete_batch',
      'reassign_batch',
      'create_class',
      'edit_class',
      'delete_class',
      'enroll_student',
      'unenroll_student',
      'mark_attendance',
    ],
  })
  @ApiQuery({
    name: 'resourceType',
    required: false,
    type: String,
    description:
      'Filter by resource type - use /trackinglog/filters/available to see all available types',
    enum: [
      '',
      'bootcamp',
      'course',
      'batch',
      'class',
      'module',
      'user',
      'student',
    ],
  })
  @ApiQuery({
    name: 'role',
    required: false,
    type: String,
    description: 'Filter by user role',
    enum: ['', 'admin', 'instructor', 'ops_team', 'support', 'content'],
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by action status',
    enum: ['', 'success', 'failed', 'pending'],
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description:
      'Filter logs from this date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)',
    example: '2026-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description:
      'Filter logs until this date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)',
    example: '2026-01-31',
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
    if (query.resourceType === '--' || query.resourceType === '') {
      query.resourceType = undefined;
    }

    // Extract user role from request (assumes JWT payload contains role)
    const userRole = req.user?.role;
    return this.trackinglogService.findAll(query, userRole);
  }
}
