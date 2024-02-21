import { Controller, Get, Post, Put, Delete, Patch, Body, Param, ValidationPipe, UsePipes, Res, Req } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { CreateDto, ScheduleDto, CreateLiveBroadcastDto } from './dto/classes.dto';
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
    constructor(private classesService: ClassesService) { }

    @Get('/')
    @ApiOperation({ summary: "Google authenticate" })
    async googleAuth(@Res() res) {
        return this.classesService.googleAuthentication(res);
    }

    @Get('/redirect')
    @ApiOperation({ summary: "Google authentication redirect" })
    async googleAuthRedirect(@Req() request) {
        return this.classesService.googleAuthenticationRedirect(request);
    }

    @Post('/')
    @ApiOperation({ summary: "Create the new class" })
    async create(@Body() classData: CreateLiveBroadcastDto) {
        return this.classesService.createLiveBroadcast(classData);
    }
    @Get('/getClassesByBatchId/:batchId')
    @ApiOperation({ summary: "Get the google classes by batchId" })
    getClassesByBatchId(@Param('batchId') batchId: string): Promise<object> {
        return this.classesService.getClassesByBatchId(batchId);
    }
    @Get('/getClassesByBootcampId/:bootcampId')
    @ApiOperation({ summary: "Get the google classes by bootcampId" })
    getClassesByBootcampId(@Param('bootcampId') bootcampId: string): Promise<object> {
        return this.classesService.getClassesByBootcampId(bootcampId);
    }
    @Get('/getAttendeesByMeetingId/:id')
    @ApiOperation({ summary: "Get the google class attendees by meetingId" })
    getAttendeesByMeetingId(@Param('id') id: number): Promise<object> {
        return this.classesService.getAttendeesByMeetingId(id);
    }
    @Get('/:id')
    @ApiOperation({ summary: "getting meeting By id" })
    getMeetingById(@Param('id') id: number): Promise<object> {
        return this.classesService.getMeetingById(id);
    }

    @Delete('/:id')
    @ApiOperation({ summary: "Delete the meeting" })
    deleteMeetingById(@Param('id') id: number): Promise<object> {
        return this.classesService.deleteMeetingById(id);
    }

    // @Patch('/:id')
    // @ApiOperation({ summary: "Patch the meeting details" })
    // updateMeetingById(@Param('id') id: number, @Body() classData: CreateLiveBroadcastDto) {
    //     return this.classesService.updateMeetingById(id, classData);
    // }
}
