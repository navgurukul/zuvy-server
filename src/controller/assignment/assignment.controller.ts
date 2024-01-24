import { Controller, Get, Post, Put, Delete, Body, Param, ValidationPipe, UsePipes } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth  } from '@nestjs/swagger';
// import { AuthGuard } from '@nestjs/passport'; // Assuming JWT authentication
import { AssignmentDto } from './dto/assignment.dto';

// swagger body schema for 
@Controller('assignment')
@ApiTags('assignment')
@UsePipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
}))
export class AssignmentController {
    constructor(private assignmentService: AssignmentService) { }
    @Get('/:id')
    @ApiOperation({ summary: "Get the Assignment by id"})
    getAssignmentById(@Param('id') id: string): Promise<object> {
        return this.assignmentService.getAssignmentById(parseInt(id));
    }
    
    @Post('/')
    @ApiOperation({ summary: "Create the new Assignment"})
    createAssignment(@Body() AssignmentData: AssignmentDto) {
        return this.assignmentService.createAssignment(AssignmentData);
    }

    @Put('/:id')
    @ApiOperation({ summary: "Put the Assignment by id"})
    updateAssignment(@Param('id') id: string, @Body() AssignmentData: AssignmentDto) {
        return this.assignmentService.updateAssignment(parseInt(id),AssignmentData);
    }

    @Delete('/:id')
    @ApiOperation({ summary: "Delete the Assignment by id"})
    deleteAssignment(@Param('id') id: string) {
        return this.assignmentService.deleteAssignment(parseInt(id));
    }
}
