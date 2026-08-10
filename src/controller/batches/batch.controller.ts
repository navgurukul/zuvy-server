import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ValidationPipe,
  UsePipes,
  BadRequestException,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { BatchesService } from './batch.service';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { BatchDto, PatchBatchDto } from './dto/batch.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { TrackAction } from 'src/trackinglog/decorators/track-action.decorator';
import { TrackActionInterceptor } from 'src/trackinglog/interceptors/track-action.interceptor';
import { PermissionsGuard } from 'src/rbac/guards/permissions.guard';
import { SkipOrgCheck } from 'src/rbac/decorators/skip-org-check.decorator';

// swagger body schema for batch
@Controller('batch')
@ApiTags('batch')
@UseInterceptors(TrackActionInterceptor)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class BatchesController {
  constructor(private batchService: BatchesService) {}

  @SkipOrgCheck()
  @Get('/:id')
  @ApiOperation({ summary: 'Get the batch by id' })
  @ApiBearerAuth('JWT-auth')
  // @ApiQuery({ name: 'students', required: false, type: Boolean, description: 'Optional content flag' })
  async getBatchById(
    @Param('id') id: number,
    @Req() req: any,
  ): Promise<object> {
    const [err, res] = await this.batchService.getBatchById(id);
    if (err) {
      throw new BadRequestException(err);
    }

    const user = req.user;
    const isInstructor = user?.roles?.includes('instructor');
    const isAdmin =
      user?.roles?.includes('admin') || user?.roles?.includes('super_admin');

    if (isInstructor && !isAdmin) {
      if (res['batch'].instructorId !== Number(user.id)) {
        throw new ForbiddenException(
          'You are not authorized to view this batch',
        );
      }
    }
    return res;
  }

  @Post('/')
  @ApiOperation({ summary: 'Create the new batch' })
  @ApiBearerAuth('JWT-auth')
  @TrackAction({
    action: 'create_batch',
    resourceType: 'batch',
    permissionName: 'createBatch',
    getResourceName: (result) => {
      const batchName = result?.batch?.name || 'Batch';
      const bootcampName = result?.bootcampName || '';
      return bootcampName
        ? `${batchName} for course ${bootcampName}`
        : batchName;
    },
  })
  async createBatch(@Body() batchData: BatchDto) {
    const [err, res] = await this.batchService.createBatch(batchData);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Put('/:id')
  @ApiOperation({ summary: 'Put the batch by id' })
  @ApiBearerAuth('JWT-auth')
  @TrackAction({
    action: 'edit_batch',
    resourceType: 'batch',
    permissionName: 'editBatch',
    getResourceName: (result) => {
      const batchName = result?.batch?.name || 'Batch';
      const bootcampName = result?.bootcampName || '';
      return bootcampName
        ? `${batchName} for course ${bootcampName}`
        : batchName;
    },
  })
  async updateBatch(@Param('id') id: string, @Body() batchData: PatchBatchDto) {
    const [err, res] = await this.batchService.updateBatch(
      parseInt(id),
      batchData,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Delete the batch by id' })
  @ApiBearerAuth('JWT-auth')
  @TrackAction({
    action: 'delete_batch',
    resourceType: 'batch',
    permissionName: 'deleteBatch',
    getResourceName: (result) => result?.batchName || 'Batch',
  })
  async deleteBatch(@Param('id') id: string) {
    const [err, res] = await this.batchService.deleteBatch(parseInt(id));
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Update the Batch partially' })
  @ApiBearerAuth('JWT-auth')
  @TrackAction({
    action: 'edit_batch',
    resourceType: 'batch',
    permissionName: 'editBatch',
    getResourceName: (result) => result?.batch?.name || 'Batch',
  })
  async updatePartialBatch(
    @Param('id') id: string,
    @Body() patchBatchDto: PatchBatchDto,
  ) {
    const [err, res] = await this.batchService.updateBatch(
      parseInt(id),
      patchBatchDto,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Patch('reassign/student_id/:student_id/new_batch_id/:new_batch_id')
  @ApiQuery({
    name: 'old_batch_id',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'bootcamp_id',
    required: false,
    type: Number,
  })
  @ApiOperation({ summary: 'reassign Batch' })
  @ApiBearerAuth('JWT-auth')
  @TrackAction({
    action: 'reassign_batch',
    resourceType: 'batch',
    permissionName: 'editBatch',
    getResourceName: (result) =>
      result?.data?.name || result?.data?.batchName || 'Batch',
    getBootcampId: (result, params) =>
      params?.bootcamp_id ? Number(params.bootcamp_id) : null,
  })
  async reassignBatch(
    @Param('student_id') studentID: string,
    @Param('new_batch_id') newBatchID: number,
    @Query('old_batch_id') oldBatchID: number,
    @Query('bootcamp_id') bootcampID: number,
  ) {
    const [err, res] = await this.batchService.reassignBatch(
      studentID,
      newBatchID,
      oldBatchID,
      bootcampID,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/allUnassignStudent/:bootcampId')
  @ApiOperation({
    summary: 'Get students not enrolled in any batch for a specific bootcamp',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search by name or email',
  })
  @ApiBearerAuth('JWT-auth')
  async getNotEnrolledStudents(
    @Param('bootcampId') bootcampId: number,
    @Query('searchTerm') searchTerm: string,
  ): Promise<object> {
    const [err, res] = await this.batchService.getNotEnrolledStudents(
      bootcampId,
      searchTerm,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return {
      status: res.status,
      message: res.message,
      StatusCode: res.statusCode,
      data: res.data,
    };
  }
}
