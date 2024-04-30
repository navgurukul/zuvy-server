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
      topicId
    );
    return res;
  }

  @Post('/quiz')
  @ApiOperation({ summary: 'Create a quiz' })
  @ApiBearerAuth()
  async createQuizForModule(@Body() quizQuestions: quizBatchDto,@Query('chapterId')chapterId:number) {
    const res = await this.contentService.createQuizForModule(quizQuestions,chapterId);
    return res;
  }

  // @Post('/chapterQuiz/:moduleId')
  // @ApiOperation({ summary: 'Create a chapter quiz for this module' })
  // @ApiQuery({
  //   name: 'topicId',
  //   required: true,
  //   type: Number,
  //   description: 'topic id',
  // })
  // @ApiBearerAuth()
  // async createChapterQuiz(
  //   @Body() chapterQuiz: chapterDto,
  //   @Param('moduleId') moduleId: number,
  //   @Query('topicId') topicId: number,
  // ) {
  //   const res = await this.contentService.createChapterQuiz(
  //     moduleId,
  //     topicId,
  //     chapterQuiz,
  //   );
  //   return res;
  // }

  @Post('/createOpenEndedQuestion')
  @ApiOperation({ summary: 'Create a open ended question' })
  @ApiBearerAuth()
  async createOpenEndedQuestion(@Body() oEndedQuestions: openEndedDto) {
    const res =
      await this.contentService.createOpenEndedQuestions(oEndedQuestions);
    return res;
  }

  @Post('/codingQuestion/:moduleId')
  @ApiOperation({ summary: 'Create a coding question for this module' })
  @ApiQuery({
    name: 'topicId',
    required: true,
    type: Number,
    description: 'topic id',
  })
  @ApiBearerAuth()
  async createCodingQuestionForModule(
    @Body() codingQuestions: CreateProblemDto,
    @Param('moduleId') moduleId: number,
    @Query('chapterId') chapterId: number,
  ) {
    const chapterDetails = {
      title: 'Coding Problems'
    };
    const res = await this.contentService.createCodingProblemForModule(
      moduleId,
      chapterId,
      codingQuestions,
    );
    return res;
  }

  @Post('/createAssessment/:moduleId')
  @ApiOperation({ summary: 'Create a assessment for this module' })
  @ApiBearerAuth()
  async createAssessment(
    @Body() assessmentBody: CreateAssessmentBody,
    @Param('moduleId') moduleId: number,
  ) {
    const res = await this.contentService.createAssessment(
      moduleId,
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


  

}
