import { Controller, Get, Post, Put, Delete, Patch, Body, Param, ValidationPipe, UsePipes,BadRequestException } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { CreateAssignmentDto, PatchAssignmentDto } from './dto/assignment.dto';
import { CreateArticleDto } from './dto/article.dto';
import { CreateQuizDto, PutQuizDto } from './dto/quiz.dto';

@Controller('tracking')
@ApiTags('tracking')
@ApiCookieAuth()
@UsePipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
}))
// @UseGuards(AuthGuard('cookie'))
export class TrackingController {
    constructor(private TrackingService: TrackingService) { }
    @Get('/:user_id')
    @ApiOperation({ summary: "Get the progress by user_id"})
    async getTracking(@Param('user_id') user_id: number): Promise<object> {
        const [err, res] = await this.TrackingService.getProgress(user_id);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }

    @Post('/assignment')
    @ApiOperation({ summary: "Create assignment submission"})
    async createAssignmentSubmission(@Body() data: CreateAssignmentDto): Promise<object> {
        const [err, res] = await this.TrackingService.createAssignmentSubmission(data);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }

    @Get('/assignment/:user_id')
    @ApiOperation({ summary: "Get assignment submission by user_id"})
    async getAssignmentSubmission(@Param('user_id') user_id: number): Promise<object> {
        const [err, res] = await this.TrackingService.getAssignmentSubmission(user_id);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }

    @Get('/assignment/:assignmentId/:userId')
    @ApiOperation({ summary: "Update assignment submission by id"})
    async assignmentSubmission( @Param('assignmentId') assignmentId: number,@Param('userId') userId: number ): Promise<object> {
        console.log(assignmentId, userId);
        const [err, res] = await this.TrackingService.assignmentSubmissionBy(userId, assignmentId);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }

    @Patch('/assignment/:id')
    @ApiOperation({ summary: "Update assignment submission by id"})
    async updateAssignmentSubmission(@Param('id') id: number, @Body() data: PatchAssignmentDto): Promise<object> {
        const [err, res] = await this.TrackingService.updateAssignmentSubmission(id, data);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }

    @Post('/article')
    @ApiOperation({ summary: "Create article submission"})
    async createArticleSubmission(@Body() data: CreateArticleDto): Promise<object> {
        const [err, res] = await this.TrackingService.createArticleTracking(data);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }

    @Get('/article/:user_id')
    @ApiOperation({ summary: "Get article submission by user_id"})
    async getarticleSubmission(@Param('user_id') user_id: number): Promise<object> {
        const [err, res] = await this.TrackingService.getArticleTracking(user_id);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }

    @Get('/article/:articleId/:userId')
    @ApiOperation({ summary: "Update article submission by id"})
    async getArticleSubmission( @Param('articleId') articleId: number,@Param('userId') userId: number ): Promise<object> {
        const [err, res] = await this.TrackingService.articleTrackingBy(articleId, userId);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }

    @Post('/quiz')
    @ApiOperation({ summary: "Create quiz submission"})
    async createQuizSubmission(@Body() data: CreateQuizDto, ): Promise<object> {
        const [err, res] = await this.TrackingService.createQuizTracking(data.quiz);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }

    @Get('/quiz/:user_id')
    @ApiOperation({ summary: "Get quiz submission by user_id"})
    async getQuizSubmission(@Param('user_id') user_id: number): Promise<object> {
        const [err, res] = await this.TrackingService.getQuizTracking(user_id);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }

    @Get('/quiz/:quizId/:userId')
    @ApiOperation({ summary: "Update quiz submission by id"})
    async quizSubmission( @Param('quizId') quizId: number,@Param('userId') userId: number ): Promise<object> {
        const [err, res] = await this.TrackingService.quizTrackBy(quizId, userId);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }

    @Put('/quiz/:id')
    @ApiOperation({ summary: "Update quiz submission by id"})
    async updateQuizSubmission(@Param('id') id: number, @Body() data: PutQuizDto): Promise<object> {
        const [err, res] = await this.TrackingService.updateQuizTracking(id, data);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }
}