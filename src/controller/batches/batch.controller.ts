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
} from '@nestjs/common';
import { BatchesService } from './batch.service';
import {
  ApiTags,
  ApiBody,
  ApiOperation,
  ApiCookieAuth,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport'; // Assuming JWT authentication
import { BatchDto, PatchBatchDto } from './dto/batch.dto';
import { bigint } from 'drizzle-orm/mysql-core';

// swagger body schema for batch
@Controller('batch')
@ApiTags('batch')
@ApiBearerAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
export class BatchesController {
  constructor(private batchService: BatchesService) {}
  @Get('/:id')
  @ApiOperation({ summary: 'Get the batch by id' })
  @ApiBearerAuth()
  // @ApiQuery({ name: 'students', required: false, type: Boolean, description: 'Optional content flag' })
  async getBatchById(@Param('id') id: number): Promise<object> {
    const [err, res] = await this.batchService.getBatchById(id);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Post('/')
  @ApiOperation({ summary: 'Create the new batch' })
  @ApiBearerAuth()
  async createBatch(@Body() batchData: BatchDto) {
    const [err, res] = await this.batchService.createBatch(batchData);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Put('/:id')
  @ApiOperation({ summary: 'Put the batch by id' })
  @ApiBearerAuth()
  async updateBatch(@Param('id') id: string, @Body() batchData: BatchDto) {
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
  @ApiBearerAuth()
  async deleteBatch(@Param('id') id: string) {
    const [err, res] = await this.batchService.deleteBatch(parseInt(id));
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Update the Batch partially' })
  @ApiBearerAuth()
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

  @Patch(
    'reassign/student_id:student_id/new_batch_id:new_batch_id/old_batch_id:old_batch_id',
  )
  @ApiOperation({ summary: 'reassign Batch' })
  @ApiBearerAuth()
  async reassignBatch(
    @Param('student_id') studentID: string,
    @Param('new_batch_id') newBatchID: number,
    @Param('old_batch_id') oldBatchID: number,
  ) {
    console.log('student_id', studentID);
    console.log('new_batch', newBatchID);
    console.log('old_batch', oldBatchID);

    const [err, res] = await this.batchService.reassignBatch(
      studentID,
      newBatchID,
      oldBatchID,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }
}
