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

// swagger body schema for batch
@Controller('batch')
@ApiTags('batch')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class BatchesController {
  constructor(private batchService: BatchesService) { }

  
  @Get('/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get the batch by id' })
  @ApiBearerAuth('JWT-auth')
  // @ApiQuery({ name: 'students', required: false, type: Boolean, description: 'Optional content flag' })
  async getBatchById(@Param('id') id: number): Promise<object> {
    const [err, res] = await this.batchService.getBatchById(id);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Post('/')
  @Roles('admin')
  @ApiOperation({ summary: 'Create the new batch' })
  @ApiBearerAuth('JWT-auth')
  async createBatch(@Body() batchData: BatchDto) {
    const [err, res] = await this.batchService.createBatch(batchData);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Put('/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Put the batch by id' })
  @ApiBearerAuth('JWT-auth')
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
  @Roles('admin')
  @ApiOperation({ summary: 'Delete the batch by id' })
  @ApiBearerAuth('JWT-auth')
  async deleteBatch(@Param('id') id: string) {
    const [err, res] = await this.batchService.deleteBatch(parseInt(id));
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Patch('/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update the Batch partially' })
  @ApiBearerAuth('JWT-auth')
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

  @Patch('reassign/student_id=:student_id/new_batch_id=:new_batch_id')
  @Roles('admin')
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
  @Roles('admin')
  @ApiOperation({ summary: 'Get students not enrolled in any batch for a specific bootcamp' })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search by name or email',
  })
  @ApiBearerAuth('JWT-auth')
  async getNotEnrolledStudents(@Param('bootcampId') bootcampId: number, @Query('searchTerm') searchTerm: string): Promise<object> {
    const [err, res] = await this.batchService.getNotEnrolledStudents(bootcampId, searchTerm);
    if (err) {
      throw new BadRequestException(err);
    }
    return { status: res.status, message: res.message, StatusCode: res.statusCode, data: res.data };
  }

}
