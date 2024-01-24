import { Controller, Get, Post, Put,Patch,  Delete, Body, Param, ValidationPipe, UsePipes } from '@nestjs/common';
import { BootcampService } from './bootcamp.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth  } from '@nestjs/swagger';
import { CreateBootcampDto, EditBootcampDto, PatchBootcampDto } from './dto/bootcamp.dto';
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
    getBootcampById(@Param('id') id: string): Promise<object> {
        return this.bootcampService.getBootcampById(parseInt(id));
    }

    @Post('/')
    @ApiOperation({ summary: "Create the new bootcamp"})
    async create(@Body() bootcampsEntry: CreateBootcampDto) {
        return this.bootcampService.createBootcamp(bootcampsEntry);
    }

    @Put('/:id')
    @ApiOperation({ summary: "Update the bootcamp"})
    updateBootcamp(@Param('id') id: string, @Body() editBootcampDto: EditBootcampDto ) {
        return this.bootcampService.updateBootcamp(parseInt(id), editBootcampDto);
    }

    @Delete('/:id')
    @ApiOperation({ summary: "Delete the bootcamp"})
    deleteBootcamp(@Param('id') id: string): Promise<object> {
        return this.bootcampService.deleteBootcamp(parseInt(id));
    }
    @Get('/batches/:bootcamp_id')
    @ApiOperation({ summary: "Get the batches by bootcamp_id"})
    getBatchByIdBootcamp(@Param('bootcamp_id') bootcamp_id: string): Promise<object> {
        return this.bootcampService.getBatchByIdBootcamp(parseInt(bootcamp_id));
    }

    @Patch('/:id')
    @ApiOperation({ summary: 'Update the bootcamp partially' })
    updatePartialBootcamp(@Param('id') id: string, @Body() patchBootcampDto: PatchBootcampDto) {
        return this.bootcampService.updatePartialBootcamp(parseInt(id), patchBootcampDto);
    }
}

