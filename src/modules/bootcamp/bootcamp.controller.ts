import { Controller, Get, Post, Put, Delete, Body, Param} from '@nestjs/common';
import { BootcampService } from './bootcamp.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth  } from '@nestjs/swagger';
import { CreateBootcampDto } from './dto/bootcamp.dto';
import {EditBootcampDto} from './dto/edit_bootcamp.dto';
import { ValidationPipe } from '@nestjs/common';

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
    @ApiBody({
        schema: {
        type: 'object',
        properties: {
            coverImage: {
                type: 'string',
                description: 'The bootcamp cover image',
            },
            bootcampName: {
                type: 'string',
                description: 'The bootcamp name',
            },
            bootcampTopic: {
                type: 'string',
                description: 'The bootcamp topic',
            },
            instractor_email: {
                type: 'string',
                description: 'The instractor email',
            },
            schedules: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        startTime: {
                            type: 'string',
                            description: 'The schedule start time',
                        },
                        endTime: {
                            type: 'string',
                            description: 'The schedule end time',
                        },
                        day: {
                            type: 'string',
                            description: 'The schedule day',
                        },
                    },
                },
            },
            language: {
                type: 'string',
                description: 'The bootcamp language',
            },
            capEnrollment: {
                type: 'number',
                description: 'The bootcamp cap enrollment',
            },
        },
        }
    })
    async create(@Body(new ValidationPipe()) createBootcampDto: CreateBootcampDto) {
        return this.bootcampService.createBootcamp(createBootcampDto);
    }

    @Put('/:id')
    @ApiOperation({ summary: "Update the bootcamp"})
    @ApiBody({
        schema: {
        type: 'object',
        properties: {
            coverImage: {
                type: 'string',
                description: 'The bootcamp cover image',
            },
            bootcampName: {
                type: 'string',
                description: 'The bootcamp name',
            },
            bootcampTopic: {
                type: 'string',
                description: 'The bootcamp topic',
            },
            instractor_email: {
                type: 'string',
                description: 'The instractor email',
            },
            schedules: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        startTime: {
                            type: 'string',
                            description: 'The schedule start time',
                        },
                        endTime: {
                            type: 'string',
                            description: 'The schedule end time',
                        },
                        day: {
                            type: 'string',
                            description: 'The schedule day',
                        },
                    },
                },
            },
            language: {
                type: 'string',
                description: 'The bootcamp language',
            },
            capEnrollment: {
                type: 'number',
                description: 'The bootcamp cap enrollment',
            },
        },}
    })
    updateBootcamp(@Param('id') id: string, @Body(new ValidationPipe()) createBootcampDto: EditBootcampDto): Promise<object> {
        return this.bootcampService.updateBootcamp(parseInt(id), createBootcampDto);
    }

    @Delete('/:id')
    @ApiOperation({ summary: "Delete the bootcamp"})
    deleteBootcamp(@Param('id') id: string): Promise<object> {
        return this.bootcampService.deleteBootcamp(parseInt(id));
    }
}

