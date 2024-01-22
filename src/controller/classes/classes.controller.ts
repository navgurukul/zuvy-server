import { Controller, Get, Post, Put, Delete, Body, Param, ValidationPipe, UsePipes } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth  } from '@nestjs/swagger';
import {  CreateDto, ScheduleDto } from './dto/classes.dto';
// import { AuthGuard } from '@nestjs/passport'; // Assuming JWT authentication


@Controller('classes')
@ApiTags('classes')
@ApiCookieAuth()
@UsePipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
}))
// @UseGuards(AuthGuard('cookie'))
export class ClassesController {
    constructor(private classesService:ClassesService) { }

    @Post('/')
    @ApiOperation({ summary: "Create the new bootcamp"})
    async create(@Body() classData: ScheduleDto) {
        return this.classesService.createLiveBroadcast();
    }

    // @Put('/:id')
    // @ApiOperation({ summary: "Update the bootcamp"})
    // updateBootcamp(@Param('id') id: string, @Body() editBootcampDto: EditBootcampDto ) {
    //     return this.bootcampService.updateBootcamp(parseInt(id), editBootcampDto);
    // }

    // @Delete('/:id')
    // @ApiOperation({ summary: "Delete the bootcamp"})
    // deleteBootcamp(@Param('id') id: string): Promise<object> {
    //     return this.bootcampService.deleteBootcamp(parseInt(id));
    // }
    // @Get('/batches/:bootcamp_id')
    // @ApiOperation({ summary: "Get the batches by bootcamp_id"})
    // getBatchByIdBootcamp(@Param('bootcamp_id') bootcamp_id: string): Promise<object> {
    //     return this.bootcampService.getBatchByIdBootcamp(parseInt(bootcamp_id));
    // }

}

