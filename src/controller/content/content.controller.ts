import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ValidationPipe,
  UsePipes,
  Optional,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ContentService } from './content.service';
import {
  ApiTags,
  ApiBody,
  ApiOperation,
  ApiCookieAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ApiBearerAuth } from '@nestjs/swagger';
import {
  moduleDto,
  chapterDto,
  quizBatchDto,
  quizDto,
  reOrderDto,
  ReOrderModuleBody,
  EditChapterDto,
  openEndedDto,
  CreateAssessmentBody,
} from './dto/content.dto';
import { CreateProblemDto } from '../codingPlatform/dto/codingPlatform.dto';
import { difficulty } from 'drizzle/schema';

@Controller('Content')
@ApiTags('Content')
@ApiCookieAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
// @UseGuards(AuthGuard('cookie'))
export class ContentController {
  constructor(private contentService: ContentService) {}

  @Get('/modules/:bootcamp_id/')
  @ApiOperation({
    summary:
      'Get the modules of bootcamp, if user_id is provided then it will return the progress of user in the bootcamp',
  })
  @ApiQuery({
    name: 'user_id',
    required: false,
    type: Number,
    description: 'user id',
  })
  @ApiBearerAuth()
  async getModules(
    @Param('bootcamp_id') bootcamp_id: number,
    @Query('user_id') user_id: number,
  ): Promise<object> {
    const [err, res] = await this.contentService.getModules(
      bootcamp_id,
      user_id,
    );
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Get('/chapter/:module_id')
  @ApiOperation({ summary: 'Get the chapter by module_id ' })
  @ApiQuery({
    name: 'user_id',
    required: false,
    type: Number,
    description: 'user id',
  })
  @ApiBearerAuth()
  async getChapter(
    @Param('module_id') module_id: number,
    @Query('user_id') user_id: number,
  ): Promise<object> {
    const [err, res] = await this.contentService.getChapter(module_id, user_id);
    if (err) {
      throw new BadRequestException(err);
    }
    return res;
  }

  @Post('/modules/:bootcampId')
  @ApiOperation({ summary: 'Create the module of a particular bootcamp' })
  @ApiBearerAuth()
  async createModule(
    @Body() moduleData: moduleDto,
    @Param('bootcampId') bootcampId: number,
  ) {
    const res = await this.contentService.createModuleForCourse(
      bootcampId,
      moduleData,
    );
    return res;
  }

  @Post('/chapter/:moduleId')
  @ApiOperation({ summary: 'Create a chapter for this module' })
  @ApiQuery({
    name: 'topicId',
    required: true,
    type: Number,
    description: 'topic id',
  })
  @ApiBearerAuth()
  async createChapter(
    @Param('moduleId') moduleId: number,
    @Query('topicId') topicId: number,
  ) {
    const res = await this.contentService.createChapterForModule(
      moduleId,
      topicId,
    );
    return res;
  }

  @Post('/quiz')
  @ApiOperation({ summary: 'Create a quiz' })
  @ApiQuery({
    name: 'chapterId',
    required: true,
    type: Number,
    description: 'chapterId',
  })
  @ApiBearerAuth()
  async createQuizForModule(
    @Body() quizQuestions: quizBatchDto,
    @Query('chapterId') chapterId: number,
  ) {
    const res = await this.contentService.createQuizForModule(
      quizQuestions,
      chapterId,
    );
    return res;
  }

  @Post('/createOpenEndedQuestion')
  @ApiOperation({ summary: 'Create a open ended question' })
  @ApiBearerAuth()
  async createOpenEndedQuestion(@Body() oEndedQuestions: openEndedDto) {
    const res =
      await this.contentService.createOpenEndedQuestions(oEndedQuestions);
    return res;
  }

  @Post('/codingQuestion')
  @ApiOperation({ summary: 'Create a coding question for this module' })
  @ApiQuery({
    name: 'chapterId',
    required: true,
    type: Number,
    description: 'chapterId',
  })
  @ApiBearerAuth()
  async createCodingQuestionForModule(
    @Body() codingQuestions: CreateProblemDto,
    @Query('chapterId') chapterId: number,
  ) {
    const res = await this.contentService.createCodingProblemForModule(
      chapterId,
      codingQuestions,
    );
    return res;
  }

  @Post('/createAssessment/:moduleId')
  @ApiOperation({ summary: 'Create a assessment for this module' })
  @ApiBearerAuth()
  async createAssessment(@Param('moduleId') moduleId: number) {
    const res = await this.contentService.createAssessment(moduleId);
    return res;
  }

  @Put('/editAssessment/:assessmentId')
  @ApiOperation({ summary: 'Edit the assessment for this module' })
  @ApiBearerAuth()
  async editAssessment(
    @Body() assessmentBody: CreateAssessmentBody,
    @Param('assessmentId') assessmentId: number,
  ) {
    const res = await this.contentService.editAssessment(
      assessmentId,
      assessmentBody,
    );
    return res;
  }

  @Get('/getAssessment/:moduleId')
  @ApiOperation({ summary: 'Get the assessment details inside a module' })
  @ApiBearerAuth()
  async getAssessment(@Param('moduleId') moduleId: number) {
    const res = await this.contentService.getAssessmentDetails(moduleId);
    return res;
  }

  @Get('/allModules/:bootcampId')
  @ApiOperation({ summary: 'Get all modules of a course' })
  @ApiBearerAuth()
  async getAllModules(@Param('bootcampId') bootcampId: number) {
    const res = await this.contentService.getAllModuleByBootcampId(bootcampId);
    return res;
  }

  @Get('/allChaptersOfModule/:moduleId')
  @ApiOperation({ summary: 'Get all the chapters of a module' })
  @ApiBearerAuth()
  async getChapterDetailsOfModule(@Param('moduleId') moduleId: number) {
    const res = await this.contentService.getAllChaptersOfModule(moduleId);
    return res;
  }

  @Get('/chapterDetailsById/:chapterId')
  @ApiOperation({ summary: 'Get chapter details by id' })
  @ApiBearerAuth()
  async getChapterDetailsById(@Param('chapterId') chapterId: number) {
    const res = await this.contentService.getChapterDetailsById(chapterId);
    return res;
  }

  @Put('/editModuleOfBootcamp/:bootcampId')
  @ApiOperation({ summary: 'Drag and drop modules in a bootcamp' })
  @ApiQuery({
    name: 'moduleId',
    required: true,
    type: Number,
    description: 'module Id',
  })
  @ApiBearerAuth()
  async reOrderModules(
    @Body() reOrder: ReOrderModuleBody,
    @Param('bootcampId') bootcampId: number,
    @Query('moduleId') moduleId: number,
  ) {
    const res = await this.contentService.updateOrderOfModules(
      reOrder,
      bootcampId,
      moduleId,
    );
    return res;
  }

  @Put('/editChapterOfModule/:moduleId')
  @ApiOperation({ summary: 'Drag and drop modules in a bootcamp' })
  @ApiQuery({
    name: 'chapterId',
    required: true,
    type: Number,
    description: 'chapter id',
  })
  @ApiBearerAuth()
  async editChapter(
    @Body() reOrder: EditChapterDto,
    @Param('moduleId') moduleId: number,
    @Query('chapterId') chapterId: number,
  ) {
    const res = await this.contentService.editChapter(
      reOrder,
      moduleId,
      chapterId,
    );
    return res;
  }

  @Delete('/deleteModule/:bootcampId')
  @ApiOperation({ summary: 'Delete the module' })
  @ApiQuery({
    name: 'moduleId',
    required: true,
    type: Number,
    description: 'module Id',
  })
  @ApiBearerAuth()
  async deleteModule(
    @Param('bootcampId') bootcampId: number,
    @Query('moduleId') moduleId: number,
  ): Promise<object> {
    const res = await this.contentService.deleteModule(moduleId, bootcampId);
    return res;
  }

  @Delete('/deleteChapter/:moduleId')
  @ApiOperation({ summary: 'Delete the chapter' })
  @ApiQuery({
    name: 'chapterId',
    required: true,
    type: Number,
    description: 'chapter Id',
  })
  @ApiBearerAuth()
  async deleteChapter(
    @Param('moduleId') moduleId: number,
    @Query('chapterId') chapterId: number,
  ): Promise<object> {
    const res = await this.contentService.deleteChapter(chapterId, moduleId);
    return res;
  }

  @Get('/allQuizQuestions')
  @ApiOperation({ summary: 'Get all quiz Questions' })
  @ApiQuery({
    name: 'tagId',
    required: false,
    type: Number,
    description: 'tagId',
  })
  @ApiQuery({
    name: 'difficulty',
    required: false,
    type: String,
    description: 'difficulty',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search by name or email',
  })
  @ApiBearerAuth()
  async getAllQuizQuestions(
    @Query('tagId') tagId: number,
    @Query('difficulty') difficulty: 'Easy' | 'Medium' | 'Hard',
    @Query('searchTerm') searchTerm: string,
  ): Promise<object> {
    const res = await this.contentService.getAllQuizQuestions(
      tagId,
      difficulty,
      searchTerm,
    );
    return res;
  }

  @Get('/allCodingQuestions')
  @ApiOperation({ summary: 'Get all coding Questions' })
  @ApiQuery({
    name: 'tagId',
    required: false,
    type: Number,
    description: 'tagId',
  })
  @ApiQuery({
    name: 'difficulty',
    required: false,
    type: String,
    description: 'difficulty',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search by name or email',
  })
  @ApiBearerAuth()
  async getAllCodingQuestions(
    @Query('tagId') tagId: number,
    @Query('difficulty') difficulty: 'Easy' | 'Medium' | 'Hard',
    @Query('searchTerm') searchTerm: string,
  ): Promise<object> {
    const res = await this.contentService.getAllCodingQuestions(
      tagId,
      difficulty,
      searchTerm,
    );
    return res;
  }
}
