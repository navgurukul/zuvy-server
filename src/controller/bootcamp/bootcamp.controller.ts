import { Controller, Get, Post, Put, Patch, Delete, Body, Param, ValidationPipe, UsePipes, Optional, Query, BadRequestException } from '@nestjs/common';
import { BootcampService } from './bootcamp.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { CreateBootcampDto, EditBootcampDto, PatchBootcampDto, studentDataDto } from './dto/bootcamp.dto';
// import { EditBootcampDto } from './dto/editBootcamp.dto';
// import { AuthGuard } from '@nestjs/passport'; // Assuming JWT authentication


@Controller('bootcamp')
@ApiTags('bootcamp')
@ApiCookieAuth()
@UsePipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
}))
// @UseGuards(AuthGuard('cookie'))
export class BootcampController {
    constructor(private bootcampService: BootcampService) { }
    @Get('/')
    @ApiOperation({ summary: "Get all bootcamps" })
    async getAllBootcamps(): Promise<object> {
        const [err, res] = await this.bootcampService.getAllBootcamps();
        if (err) {
            throw new BadRequestException(err);
        }
        return res;
    }

    @Get('/:id')
    @ApiOperation({ summary: "Get the bootcamp by id" })
    @ApiQuery({ name: 'isContent', required: false, type: Boolean, description: 'Optional content flag' })
    async getBootcampById(@Param('id') id: number, @Query('isContent') isContent: boolean = false): Promise<object> {
        const [err, res] = await this.bootcampService.getBootcampById(id, isContent);
        if (err) {
            throw new BadRequestException(err);
        }
        return res;
    }

    @Post('/')
    @ApiOperation({ summary: "Create the new bootcamp" })
    async create(@Body() bootcampsEntry: CreateBootcampDto) {
        const [err, res] = await this.bootcampService.createBootcamp(bootcampsEntry);
        if (err) {
            throw new BadRequestException(err);
        }
        return res;
    }

    @Put('/:id')
    @ApiOperation({ summary: "Update the bootcamp" })
    async updateBootcamp(@Param('id') id: number, @Body() editBootcampDto: EditBootcampDto) {
        const [err, res] = await this.bootcampService.updateBootcamp(id, editBootcampDto);
        if (err) {
            throw new BadRequestException(err);
        }
        return res;
    }

    @Delete('/:id')
    @ApiOperation({ summary: "Delete the bootcamp" })
    async deleteBootcamp(@Param('id') id: number): Promise<object> {
        const [err, res] = await this.bootcampService.deleteBootcamp(id);
        if (err) {
            throw new BadRequestException(err);
        }
        return res;
    }
    @Get('/batches/:bootcamp_id')
    @ApiOperation({ summary: "Get the batches by bootcamp_id" })
    async getBatchByIdBootcamp(@Param('bootcamp_id') bootcamp_id: number): Promise<object> {
        const [err, res] = await this.bootcampService.getBatchByIdBootcamp(bootcamp_id);
        if (err) {
            throw new BadRequestException(err);
        }
        return res;
    }

    @Patch('/:id')
    @ApiOperation({ summary: 'Update the bootcamp partially' })
    async updatePartialBootcamp(@Param('id') id: number, @Body() patchBootcampDto: PatchBootcampDto) {
        const [err, res] = await this.bootcampService.updateBootcamp(id, patchBootcampDto);
        if (err) {
            throw new BadRequestException(err);
        }
        return res;
    }
    @Post('/students/:bootcamp_id')
    @ApiOperation({ summary: "Add the student to the bootcamp" })
    @ApiQuery({ name: 'batch_id', required: false, type: Number, description: 'batch id' })
    async addStudentToBootcamp(@Param('bootcamp_id') bootcamp_id: number, @Query('batch_id') batch_id: number, @Body() studentData: studentDataDto) {
        const [err, res] = await this.bootcampService.addStudentToBootcamp(bootcamp_id, batch_id, studentData.students);
        if (err) {
            throw new BadRequestException(err);
        }
        return res;
    }

    @Get('/students/:bootcamp_id')
    @ApiOperation({ summary: "Get the students by bootcamp_id" })
    @ApiQuery({ name: 'batch_id', required: false, type: Number, description: 'batch id' })
    async getStudentsByBootcamp(@Param('bootcamp_id') bootcamp_id: number, @Query('batch_id') batch_id: number): Promise<object> {
        const [err, res] = await this.bootcampService.getStudentsByBootcampOrBatch(bootcamp_id, batch_id);
        if (err) {
            throw new BadRequestException(err);
        }
        return res;
    }

    @Get('/:user_id/progress')
    @ApiOperation({ summary: "Get the progress of students in a bootcamp" })
    @ApiQuery({ name: 'bootcamp_id', required: false, type: Number, description: 'bootcamp_id' })
    async getStudentProgressByBootcamp(@Param('user_id') user_id: number, @Query('bootcamp_id') bootcamp_id: number): Promise<object> {
        const [err, res] = await this.bootcampService.getStudentProgressBy(user_id, bootcamp_id);
        if (err) {
            throw new BadRequestException(err);
        }
        return res;
    }
}

