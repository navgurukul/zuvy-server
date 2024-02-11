import { Controller, Get, Post, Put, Delete, Patch, Body, Param, ValidationPipe, UsePipes,BadRequestException } from '@nestjs/common';
import { StudentService } from './student.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { get } from 'http';
// import { CreateDto, ScheduleDto, CreateLiveBroadcastDto } from './dto/Student.dto';
// import { AuthGuard } from '@nestjs/passport'; // Assuming JWT authentication


@Controller('Student')
@ApiTags('Student')
@ApiCookieAuth()
@UsePipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
}))
// @UseGuards(AuthGuard('cookie'))
export class StudentController {
    constructor(private studentService: StudentService) { }

    @Get('/:userId')
    @ApiOperation({ summary: "Get all course enrolled by student"})
    async getAllStudents(@Param('userId') userId: number): Promise<object> {
        const [err, res] = await this.studentService.enrollData(userId);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }

    @Get('/batches/:bootcamp_id')
    @ApiOperation({ summary: "Get the batches by bootcamp_id"})
    async getBatchByIdBootcamp(@Param('bootcamp_id') bootcamp_id: number): Promise<object> {
        const [err, res] = await this.studentService.enrollData(bootcamp_id);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }
}