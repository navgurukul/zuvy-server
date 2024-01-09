import { Controller, Get, Post, Put, Delete, Body, Param} from '@nestjs/common';
import { BootcampService } from './bootcamp.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth  } from '@nestjs/swagger';
import { bootcampsEntry } from './bootcamp.entry';
// import { AuthGuard } from '@nestjs/passport'; // Assuming JWT authentication


@Controller('bootcamp')
@ApiTags('bootcamp')
@ApiCookieAuth()
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
    @ApiBody(bootcampsEntry)
    async create(@Body() bootcampsEntry ) {
        return this.bootcampService.createBootcamp(bootcampsEntry);
    }

    @Put('/:id')
    @ApiOperation({ summary: "Update the bootcamp"})
    @ApiBody(bootcampsEntry)
    updateBootcamp(@Param('id') id: string, @Body() bootcampsEntry) {
        return this.bootcampService.updateBootcamp(parseInt(id), bootcampsEntry);
    }

    @Delete('/:id')
    @ApiOperation({ summary: "Delete the bootcamp"})
    deleteBootcamp(@Param('id') id: string): Promise<object> {
        return this.bootcampService.deleteBootcamp(parseInt(id));
    }
}

