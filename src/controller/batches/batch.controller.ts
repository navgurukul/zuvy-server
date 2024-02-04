import { Controller, Get, Post, Put, Patch, Delete, Body, Param, ValidationPipe, UsePipes } from '@nestjs/common';
import { BatchesService } from './batch.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth  } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport'; // Assuming JWT authentication
import {BatchDto, PatchBatchDto} from './dto/batch.dto';

// swagger body schema for batch
@Controller('batch')
@ApiTags('batch')
@UsePipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
}))
export class BatchesController {
    constructor(private batchService: BatchesService) { }
    @Get('/:id')
    @ApiOperation({ summary: "Get the batch by id"})
    getBatchById(@Param('id') id: string): Promise<object> {
        return this.batchService.getBatchById(parseInt(id));
    }
    
    @Post('/')
    @ApiOperation({ summary: "Create the new batch"})
    createBatch(@Body() batchData: BatchDto) {
        return this.batchService.createBatch(batchData);
    }

    @Put('/:id')
    @ApiOperation({ summary: "Put the batch by id"})
    updateBatch(@Param('id') id: string, @Body() batchData: BatchDto) {
        return this.batchService.updateBatch(parseInt(id),batchData);
    }

    @Delete('/:id')
    @ApiOperation({ summary: "Delete the batch by id"})
    deleteBatch(@Param('id') id: string) {
        return this.batchService.deleteBatch(parseInt(id));
    }

    @Patch('/:id')
    @ApiOperation({ summary: 'Update the Batch partially' })
    updatePartialBatch(@Param('id') id: string, @Body() patchBatchDto: PatchBatchDto) {
        return this.batchService.updatePartialBatch(parseInt(id), patchBatchDto);
    }
}
