import { Controller, Get, Post, Put,Patch,  Delete, Body, Param, ValidationPipe, UsePipes, Optional, Query, BadRequestException} from '@nestjs/common';
import { BootcampService } from './bootcamp.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth, ApiQuery} from '@nestjs/swagger';
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
    constructor(private bootcampService:BootcampService) { }
    
    @Get('/')
    @ApiOperation({ summary: "Get all bootcamps"})
    getAllBootcamps(): Promise<object> {
        return this.bootcampService.getAllBootcamps();
    }

    @Get('/:id')
    @ApiOperation({ summary: "Get the bootcamp by id"})
    @ApiQuery({ name: 'isContent', required: false, type: Boolean, description: 'Optional content flag' })
    getBootcampById(@Param('id') id: number, @Query('isContent') isContent: boolean = false): Promise<object> {
        return this.bootcampService.getBootcampById(id, isContent);
    }

    @Post('/')
    @ApiOperation({ summary: "Create the new bootcamp"})
    async create(@Body() bootcampsEntry: CreateBootcampDto) {
        return this.bootcampService.createBootcamp(bootcampsEntry);
    }

    @Put('/:id')
    @ApiOperation({ summary: "Update the bootcamp"})
    updateBootcamp(@Param('id') id: number, @Body() editBootcampDto: EditBootcampDto ) {
        return this.bootcampService.updateBootcamp(id, editBootcampDto);
    }

    @Delete('/:id')
    @ApiOperation({ summary: "Delete the bootcamp"})
    deleteBootcamp(@Param('id') id: number): Promise<object> {
        return this.bootcampService.deleteBootcamp(id);
    }
    @Get('/batches/:bootcamp_id')
    @ApiOperation({ summary: "Get the batches by bootcamp_id"})
    getBatchByIdBootcamp(@Param('bootcamp_id') bootcamp_id: number): Promise<object> {
        return this.bootcampService.getBatchByIdBootcamp(bootcamp_id);
    }

    @Patch('/:id')
    @ApiOperation({ summary: 'Update the bootcamp partially' })
    updatePartialBootcamp(@Param('id') id: number, @Body() patchBootcampDto: PatchBootcampDto) {
        return this.bootcampService.updateBootcamp(id, patchBootcampDto);
    }
    @Post('/students/:bootcamp_id')
    @ApiOperation({ summary: "Add the student to the bootcamp"})
    @ApiQuery({ name: 'batch_id', required: false, type: Number, description: 'batch id' })
    addStudentToBootcamp(@Param('bootcamp_id') bootcamp_id: number, @Query('batch_id') batch_id: number, @Body() studentData: studentDataDto) {
        return this.bootcampService.addStudentToBootcamp(bootcamp_id, batch_id, studentData.students);
    }

    @Get('/students/:bootcamp_id')
    @ApiOperation({ summary: "Get the students by bootcamp_id"})
    async getStudentsByBootcamp(@Param('bootcamp_id') bootcamp_id: number): Promise<object> {
        const [err, res] = await this.bootcampService.getStudentsByBootcampOrBatch(bootcamp_id, null);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }
}

