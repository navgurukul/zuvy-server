import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Patch,
    Body,
    Param,
    ValidationPipe,
    UsePipes,
    BadRequestException,
    Query,
    UseInterceptors,
} from '@nestjs/common';
import { TrackingService } from './tracking.service';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiCookieAuth,
  ApiOAuth2,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
    CreateAssignmentDto,
    PatchAssignmentDto,
    TimeLineAssignmentDto,
} from './dto/assignment.dto';
import { CreateArticleDto } from './dto/article.dto';
import { CreateQuizDto, PutQuizDto } from './dto/quiz.dto';

@Controller('tracking')
@ApiTags('tracking')
// @ApiCookieAuth()
// @UsePipes(new ValidationPipe({
//     whitelist: true,
//     transform: true,
//     forbidNonWhitelisted: true,
// }))
// @ApiOAuth2(['pets:write'])

// @UseGuards(AuthGuard('cookie'))
export class TrackingController {
  constructor(private TrackingService: TrackingService) {}

  @Get('/:user_id/:module_id')
  @ApiOperation({ summary: 'Get the progress by user_id' })
  @ApiBearerAuth()
  async getTracking(
    @Param('userID') userID: number,
    @Param('moduleID') moduleID: number,
    @Param('bootcampID') bootcampID: number,
  ): Promise<object> {
    const [err, res] = await this.TrackingService.getProgress(
      userID,
      moduleID,
      bootcampID,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Post('/assignment/timeline')
  @ApiOperation({ summary: 'Create assignment Time Line' })
  @ApiBearerAuth()
  async assignmentTimeLine(
    @Body() data: TimeLineAssignmentDto,
  ): Promise<object> {
    const [err, res] = await this.TrackingService.assignmentTimeLine(data);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Post('/assignment')
  @ApiOperation({ summary: 'Create assignment submission' })
  @ApiBearerAuth()
  async assignmentSubmission(
    @Body() data: CreateAssignmentDto,
    @Query('bootcamp_id') bootcampId: number,
    @Query('assignment_id') assignmentId: number,
    @Query('user_id') userId: number,
  ): Promise<object> {
    console.log('data:', data);
    console.log('bootcampId:', bootcampId);
    console.log('assignmentId:', assignmentId);
    console.log('userId:', userId);

    const [err, res] = await this.TrackingService.submissionAssignment(
      data,
      bootcampId,
      assignmentId,
      userId,
    );

    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/assignment/upcomming/:user_id')
  @ApiOperation({
    summary: 'Get assignment upcomming by user_id and bootcamp_id',
  })
  @ApiBearerAuth()
  async getAssignmentUpcomming(
    @Param('user_id') user_id: number,
    @Query('bootcamp_id') bootcamp_id: number,
  ): Promise<object> {
    const [err, res] = await this.TrackingService.getAssignmentUpcomming(
      user_id,
      bootcamp_id,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/assignment/:assignmentId/:userId')
  @ApiOperation({ summary: 'Update assignment submission by id' })
  @ApiBearerAuth()
  async getAssignmentSubmissionBy(
    @Param('assignmentId') assignmentId: number,
    @Param('userId') userId: number,
  ): Promise<object> {
    const [err, res] = await this.TrackingService.assignmentSubmissionBy(
      userId,
      assignmentId,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Patch('/assignment/:id')
  @ApiOperation({ summary: 'Update assignment submission by id' })
  @ApiBearerAuth()
  async updateAssignmentSubmission(
    @Param('id') id: number,
    @Body() data: PatchAssignmentDto,
  ): Promise<object> {
    const [err, res] = await this.TrackingService.updateAssignmentSubmission(
      id,
      data,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Post('/article')
  @ApiOperation({ summary: 'Create article submission' })
  @ApiBearerAuth()
  async articleTracking(
    @Body() data: CreateArticleDto,
    @Query('bootcampId') bootcampId: number,
  ): Promise<object> {
    const [err, res] = await this.TrackingService.createArticleTracking(
      data,
      bootcampId,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/article/:user_id')
  @ApiOperation({ summary: 'Get article submission by user_id' })
  @ApiBearerAuth()
  async getarticleSubmission(
    @Param('user_id') user_id: number,
  ): Promise<object> {
    const [err, res] = await this.TrackingService.getArticleTracking(user_id);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/article/:articleId/:userId')
  @ApiOperation({ summary: 'Update article submission by id' })
  @ApiBearerAuth()
  async getArticleSubmission(
    @Param('articleId') articleId: number,
    @Param('userId') userId: number,
  ): Promise<object> {
    const [err, res] = await this.TrackingService.articleTrackingBy(
      articleId,
      userId,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Post('/quiz')
  @ApiOperation({ summary: 'Create quiz submission' })
  @ApiBearerAuth()
  async quizTracking(@Body() data: CreateQuizDto): Promise<object> {
    data.quiz.filter((q) => {
      q['userId'] = data.userId;
      q['moduleId'] = data.moduleId;
      q['quizId'] = data.quizId;
    });
    const [err, res] = await this.TrackingService.createQuizTracking(
      data.quiz,
      data.bootcampId,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/quiz/:user_id')
  @ApiOperation({ summary: 'Get quiz submission by user_id' })
  @ApiBearerAuth()
  async getQuizSubmission(@Param('user_id') user_id: number): Promise<object> {
    const [err, res] = await this.TrackingService.getQuizTracking(user_id);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/quiz/:quizId/:userId')
  @ApiOperation({ summary: 'Update quiz submission by id' })
  @ApiBearerAuth()
  async quizSubmission(
    @Param('quizId') quizId: number,
    @Param('userId') userId: number,
  ): Promise<object> {
    const [err, res] = await this.TrackingService.quizTrackBy(quizId, userId);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Put('/quiz/:id')
  @ApiOperation({ summary: 'Update quiz submission by id' })
  @ApiBearerAuth()
  async updateQuizSubmission(
    @Param('id') id: number,
    @Body() data: PutQuizDto,
  ): Promise<object> {
    const [err, res] = await this.TrackingService.updateQuizTracking(id, data);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Put('/update/:userId/:bootcampId')
  @ApiOperation({ summary: 'Update progress submission by user_id' })
  @ApiBearerAuth()
  async updateProgress(
    @Param('userId') userId: number,
    @Param('bootcampId') bootcampId: number,
  ): Promise<object> {
    const [err, res] = await this.TrackingService.updateBootcampProgress(
      userId,
      bootcampId,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/latest/learning/:userId')
  @ApiOperation({ summary: 'Get latest learning progress by user_id' })
  @ApiBearerAuth()
  async latestLearningProgress(
    @Param('userId') userId: number,
  ): Promise<object> {
    const [err, res] = await this.TrackingService.getLatestIds(userId);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }
}
