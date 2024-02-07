import { Controller, Get, Post, Put, Patch, Delete, Body, Param, ValidationPipe, UsePipes, BadRequestException } from '@nestjs/common';
import { BatchesService } from './batch.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth,ApiBearerAuth ,ApiForbiddenResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport'; // Assuming JWT authentication
import {BatchDto, PatchBatchDto} from './dto/batch.dto';

// swagger body schema for batch
@Controller('batch')
@ApiTags('batch')
@ApiBearerAuth()
@UsePipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
}))
export class BatchesController {
    constructor(private batchService: BatchesService) { }
    @Get('/:id')
    @ApiOperation({ summary: "Get the batch by id"})
    async getBatchById(@Param('id') id: string): Promise<object> {
        const [err, res] = await this.batchService.getBatchById(parseInt(id));
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }
    
    @Post('/')
    @ApiOperation({ summary: "Create the new batch"})
    async createBatch(@Body() batchData: BatchDto) {
        const [err, res] = await this.batchService.createBatch(batchData);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }

    @Put('/:id')
    @ApiOperation({ summary: "Put the batch by id"})
    async updateBatch(@Param('id') id: string, @Body() batchData: BatchDto) {
        const [err, res] = await this.batchService.updateBatch(parseInt(id),batchData);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }

    @Delete('/:id')
    @ApiOperation({ summary: "Delete the batch by id"})
    async deleteBatch(@Param('id') id: string) {
        const [err, res] = await this.batchService.deleteBatch(parseInt(id));
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }

    @Patch('/:id')
    @ApiOperation({ summary: 'Update the Batch partially' })
    async updatePartialBatch(@Param('id') id: string, @Body() patchBatchDto: PatchBatchDto) {
        const [err, res] = await this.batchService.updateBatch(parseInt(id), patchBatchDto);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }
}
