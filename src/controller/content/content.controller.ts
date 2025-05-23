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
  Req,
  UseGuards,
  Res,
  UseInterceptors,
  ParseIntPipe,
  UploadedFile,
  InternalServerErrorException,
  BadGatewayException,
  UploadedFiles
} from '@nestjs/common';
import { ContentService } from './content.service';
import {
  ApiTags,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { ApiBearerAuth } from '@nestjs/swagger';
import {
  moduleDto,
  chapterDto,
  quizBatchDto,
  // quizDto,
  reOrderDto,
  ReOrderModuleBody,
  EditChapterDto,
  openEndedDto,
  CreateAssessmentBody,
  UpdateProblemDto,
  deleteQuestionDto,
  UpdateOpenEndedDto,
  CreateTagDto,
  projectDto,
  CreateChapterDto,
  formBatchDto,
  editFormBatchDto,
  CreateTypeDto,
  CreateAndEditFormBody,
  CreateQuizzesDto,
  EditQuizBatchDto,
  AddQuizVariantsDto,
  deleteQuestionOrVariantDto
} from './dto/content.dto';
import { RolesGuard } from 'src/guards/roles.guard';
import { ErrorResponse, SuccessResponse } from 'src/errorHandler/handler';
import { Response } from 'express';
import { complairDateTyeps } from 'src/helpers/index';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express/multer';

@Controller('Content')
@ApiTags('Content')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
export class ContentController {
  constructor(private contentService: ContentService) { }

  @Post('/modules/:bootcampId')
  @ApiOperation({ summary: 'Create the module of a particular bootcamp' })
  @ApiQuery({
    name: 'typeId',
    required: true,
    type: Number,
    description: 'type id',
  })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async createModule(
    @Body() moduleData: moduleDto,
    @Param('bootcampId') bootcampId: number,
    @Query('typeId') typeId: number,
  ) {
    const res = await this.contentService.createModuleForCourse(
      bootcampId,
      moduleData,
      typeId
    );
    return res;
  }

  @Post('/projects/:bootcampId')
  @ApiOperation({ summary: 'Create a project of a particular bootcamp' })
  @ApiQuery({
    name: 'typeId',
    required: true,
    type: Number,
    description: 'type id',
  })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async createProject(
    @Body() projectData: projectDto,
    @Param('bootcampId') bootcampId: number,
    @Query('typeId') typeId: number,
  ) {
    const res = await this.contentService.createProjectForCourse(
      bootcampId,
      projectData,
      typeId
    );
    return res;
  }

  @Get('/project/:id')
  @ApiOperation({ summary: 'Get the project details of a particular bootcamp' })
  @ApiQuery({
    name: 'bootcampId',
    required: true,
    type: Number,
    description: 'bootcamp id',
  })
  @ApiBearerAuth()
  async getProjectDetails(
    @Param('id') id: number,
    @Query('bootcampId') bootcampId: number,
  ) {
    const res = await this.contentService.getProjectDetails(
      bootcampId,
      id
    );
    return res;
  }

  @Patch('/updateProjects/:projectId')
  @ApiOperation({ summary: 'Update the project' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async updateProject(
    @Body() projectData: projectDto,
    @Param('projectId') projectId: number,
  ) {
    const res = await this.contentService.updateProjectDetails(
      projectId,
      projectData
    );
    return res;
  }

  @Delete('/deleteProject/:projectId')
  @ApiOperation({ summary: 'Delete the project' })
  @ApiQuery({
    name: 'bootcampId',
    required: true,
    type: Number,
    description: 'bootcamp id',
  })
  @ApiQuery({
    name: 'moduleId',
    required: true,
    type: Number,
    description: 'module id',
  })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async deleteProject(
    @Param('projectId') projectId: number,
    @Query('bootcampId') bootcampId: number,
    @Query('moduleId') moduleId: number
  ) {
    const res = await this.contentService.deleteProjectForBootcamp(
      projectId,
      moduleId,
      bootcampId
    );
    return res;
  }


  @Post('/chapter')
  @ApiOperation({ summary: 'Create a chapter for this module' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async createChapter(
    @Body() chapterData: CreateChapterDto,
  ) {
    return this.contentService.createChapterForModule(chapterData.moduleId, chapterData.topicId, chapterData.bootcampId);
  }

  @Post('/quiz')
  @ApiOperation({ summary: 'Create a quiz' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async createQuizForModule(
    @Body() quizQuestions: CreateQuizzesDto,
    @Res() res
  ): Promise<object> {
    try {
      let [err, success] = await this.contentService.createQuizForModule(
        quizQuestions
      );
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Put('/editAssessment/:assessmentOutsourseId/:chapterId')
  @ApiOperation({ summary: 'Edit the assessment for this module' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async editAssessment(
    @Body() assessmentBody: CreateAssessmentBody,
    @Param('assessmentOutsourseId') assessmentOutsourseId: number,
    @Param('chapterId') chapterId: number
  ) {
    const res = await this.contentService.editAssessment(
      assessmentOutsourseId,
      assessmentBody,
      chapterId
    );
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
  async getChapterDetailsById(@Param('chapterId') chapterId: number, @Query('bootcampId') bootcampId: number, @Query('moduleId') moduleId: number, @Query('topicId') topicId: number) {
    return this.contentService.getChapterDetailsById(chapterId, bootcampId, moduleId, topicId);
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
  @UseGuards(RolesGuard)
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

  @Delete('/deleteModule/:bootcampId')
  @ApiOperation({ summary: 'Delete the module' })
  @ApiQuery({
    name: 'moduleId',
    required: true,
    type: Number,
    description: 'module Id',
  })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async deleteModule(
    @Param('bootcampId') bootcampId: number,
    @Query('moduleId') moduleId: number,
  ): Promise<object> {
    const res = await this.contentService.deleteModule(moduleId, bootcampId);
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
  @UseGuards(RolesGuard)
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

  @Delete('/deleteChapter/:moduleId')
  @ApiOperation({ summary: 'Delete the chapter' })
  @ApiQuery({
    name: 'chapterId',
    required: true,
    type: Number,
    description: 'chapter Id',
  })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
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
    type: [Number],
    description: 'tagId',
  })
  @ApiQuery({
    name: 'difficulty',
    required: false,
    type: [String],
    description: 'difficulty',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search by name or email',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'limit',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'offset',
  })
  @ApiBearerAuth()
  async getAllQuizQuestions(
    @Query('tagId') tagId: number[],
    @Query('difficulty') difficulty: ('Easy' | 'Medium' | 'Hard') | ('Easy' | 'Medium' | 'Hard')[],
    @Query('searchTerm') searchTerm: string,
    @Query('limit') limit: number,
    @Query('offset') offSet: number,
  ): Promise<object> {
    const res = await this.contentService.getAllQuizQuestions(
      tagId,
      difficulty,
      searchTerm,
      limit,
      offSet
    );
    return res;
  }

  @Patch('/updateCodingQuestion/:questionId')
  @ApiOperation({ summary: 'Update the coding question for this module' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async updateCodingQuestionForModule(
    @Body() codingQuestions: UpdateProblemDto,
    @Param('questionId') questionId: number,
  ) {
    const res = await this.contentService.updateCodingProblemForModule(
      questionId,
      codingQuestions,
    );
    return res;
  }

  @Get('/allCodingQuestions')
  @ApiOperation({ summary: 'Get all coding Questions' })
  @ApiQuery({
    name: 'tagId',
    required: false,
    type: [Number],
    description: 'tagId',
  })
  @ApiQuery({
    name: 'difficulty',
    required: false,
    type: [String],
    description: 'difficulty',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search by name or email',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'limit',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'offset',
  })
  @ApiBearerAuth()
  async getAllCodingQuestions(
    @Query('tagId') tagId: number[],
    @Query('difficulty') difficulty: ('Easy' | 'Medium' | 'Hard') | ('Easy' | 'Medium' | 'Hard')[],
    @Query('searchTerm') searchTerm: string,
    @Query('limit') limit: number,
    @Query('offset') offSet: number,
  ): Promise<object> {
    const res = await this.contentService.getAllCodingQuestions(
      tagId,
      difficulty,
      searchTerm,
      limit,
      offSet
    );
    return res;
  }

  @Delete('/deleteCodingQuestion')
  @ApiOperation({ summary: 'Delete coding question' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async deleteCodingQuestion(@Body() questionIds: deleteQuestionDto) {
    const res = await this.contentService.deleteCodingProblem(questionIds);
    return res;
  }

  @Post('/editquiz')
  @ApiOperation({ summary: 'Edit a quiz' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async editQuizForModule(
    @Body() quizUpdates: EditQuizBatchDto,
    @Res() res
  ) {
    try {
      let [err, success] = await this.contentService.editQuizQuestion(
        quizUpdates
      );
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }



  @Delete('/deleteQuizQuestion')
  @ApiOperation({ summary: 'Delete quiz question' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async deleteQuizQuestion(@Body() questionIds: deleteQuestionDto) {
    const res = await this.contentService.deleteQuiz(questionIds);
    return res;
  }



  @Post('/createTag')
  @ApiOperation({ summary: 'Create a tag for the curriculum' })
  @ApiBearerAuth()
  async createTag(@Body() tag: CreateTagDto) {
    const res = await this.contentService.createTag(tag);
    return res;
  }

  @Get('/allTags')
  @ApiOperation({ summary: 'Get all the available tags' })
  @ApiBearerAuth()
  async getAllTags() {
    const res = await this.contentService.getAllTags();
    return res;
  }


  @Get('/openEndedQuestions')
  @ApiOperation({ summary: 'Get all open ended Questions' })
  @ApiQuery({
    name: 'tagId',
    required: false,
    type: [Number],
    description: 'tagId',
  })
  @ApiQuery({
    name: 'difficulty',
    required: false,
    type: [String],
    description: 'difficulty',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search by name or email',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'limit',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'offset',
  })
  @ApiBearerAuth()
  async getAllOpenEndedQuestions(
    @Query('tagId') tagId: number[],
    @Query('difficulty') difficulty: ('Easy' | 'Medium' | 'Hard') | ('Easy' | 'Medium' | 'Hard')[],
    @Query('searchTerm') searchTerm: string,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
  ): Promise<object> {

    const res = await this.contentService.getAllOpenEndedQuestions(
      tagId,
      difficulty,
      searchTerm,
      limit,
      offset
    );
    return res;
  }

  @Patch('/updateOpenEndedQuestion/:questionId')
  @ApiOperation({ summary: 'Update the open ended question for this module' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async updateOpenEndedQuestionForModule(
    @Body() openEndedQuestions: UpdateOpenEndedDto,
    @Param('questionId') questionId: number,
  ) {
    const res = await this.contentService.updateOpenEndedQuestion(
      questionId,
      openEndedQuestions,
    );
    return res;
  }

  @Post('/createOpenEndedQuestion')
  @ApiOperation({ summary: 'Create a open ended question' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async createOpenEndedQuestion(@Body() oEndedQuestions: openEndedDto) {
    return this.contentService.createOpenEndedQuestions(oEndedQuestions);
  }

  @Delete('/deleteOpenEndedQuestion')
  @ApiOperation({ summary: 'Delete openended question' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async deleteOpenEndedQuestion(@Body() questionIds: deleteQuestionDto) {
    return this.contentService.deleteOpenEndedQuestion(questionIds);
  }

  @Get('/students/assessmentId=:assessmentId')
  @ApiOperation({ summary: 'Get the student of a particular assessment' })
  @ApiBearerAuth()
  async getStudentsOfAssessment(@Param('assessmentId') assessmentId: number, @Query('moduleId') moduleId: number, @Query('bootcampId') bootcampId: number, @Query('chapterId') chapterId: number, @Req() req) {
    return this.contentService.getStudentsOfAssessment(assessmentId, chapterId, moduleId, bootcampId, req);
  }

  @Get('/startAssessmentForStudent/assessmentOutsourseId=:assessmentOutsourseId/newStart=:newStart')
  @ApiOperation({ summary: 'Start the assessment for a student' })
  @ApiBearerAuth()
  async startAssessmentForStudent(@Req() req, @Param('assessmentOutsourseId') assessmentOutsourseId: number, @Param('newStart') newStart:boolean, @Res() res: Response): Promise<any> {
    try{
      let [err, success] = await this.contentService.startAssessmentForStudent(assessmentOutsourseId, newStart, req.user[0]);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('/assessmentDetailsOfQuiz/:assessmentOutsourseId')
  @ApiOperation({ summary: 'Get the assessment details of the Quiz' })
  @ApiQuery({
    name: 'studentId',
    required: false,
    type: Number,
    description: 'studentId of the assessment',
  })
  @ApiBearerAuth()
  async getAssessmentDetailsOfQuiz(
    @Param('assessmentOutsourseId') assessmentOutsourseId: number,
    @Req() req,
    @Query('studentId') studentId: number,
    @Res() res: Response
  ): Promise<any> {
    try {
    let IsAdmin = !studentId ? false : true;
    const userId = studentId || req.user[0].id;

    // Create the `quizConfig` object from the query parameters
    let [err, success] = await this.contentService.getAssessmentDetailsOfQuiz(assessmentOutsourseId,req.user[0], userId, IsAdmin);
    if (err) {
      return ErrorResponse.BadRequestException(err.message).send(res);
    }
    return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('/assessmentDetailsOfOpenEnded/:assessmentOutsourseId')
  @ApiOperation({ summary: 'Get the assessment details of the open Ended questions' })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'studentId',
    required: false,
    type: Number,
    description: 'studentId of the assessment',
  })
  async getAssessmentDetailsOfOpenEnded(@Param('assessmentOutsourseId') assessmentOutsourseId: number, @Req() req, @Query('studentId') userId: number) {
    if (!userId) {
      userId = req.user[0].id;
    }
    return this.contentService.getAssessmentDetailsOfOpenEnded(assessmentOutsourseId, userId);
  }


  @Post('/createQuestionType')
  @ApiOperation({ summary: 'Create a Question Type for the form' })
  @ApiBearerAuth()
  async createQuestionType(@Body() questionType: CreateTypeDto) {
    const res = await this.contentService.createQuestionType(questionType);
    return res;
  }

  @Get('/allQuestionType')
  @ApiOperation({ summary: 'Get all the available Question Types' })
  @ApiBearerAuth()
  async getAllQuestionTypes() {
    const res = await this.contentService.getAllQuestionTypes();
    return res;
  }

  @Post('/form')
  @ApiOperation({ summary: 'Create a form' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async createFormForModule(
    @Query('chapterId') chapterId: number,
    @Body() formQuestion: formBatchDto
  ) {
    const res = await this.contentService.createFormForModule(
      chapterId,
      formQuestion
    );
    return res;
  }

  @Get('/allFormQuestions/:chapterId')
  @ApiOperation({ summary: 'Get all form Questions' })
  @ApiQuery({
    name: 'typeId',
    required: false,
    type: Number,
    description: 'typeId',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search by name or email',
  })
  @ApiBearerAuth()
  async getAllFormQuestions(
    @Param('chapterId') chapterId: number,
    @Query('typeId') typeId: number,
    @Query('searchTerm') searchTerm: string,
  ): Promise<object> {
    const res = await this.contentService.getAllFormQuestions(
      chapterId,
      typeId,
      searchTerm,
    );
    return res;
  }

  @Post('/editform')
  @ApiOperation({ summary: 'Create a form' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async editFormForModule(
    @Query('chapterId') chapterId: number,
    @Body() formQuestions: editFormBatchDto) {
    const res = await this.contentService.editFormQuestions(
      chapterId,
      formQuestions
    );
    return res;
  }


  @Post('/createAndEditForm/:chapterId')
  @ApiOperation({ summary: 'Create a form' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async createAndEditForm(
    @Param('chapterId') chapterId: number,
    @Body() formQuestions: CreateAndEditFormBody) {
    const res = await this.contentService.createAndEditFormQuestions(
      chapterId,
      formQuestions
    );
    return res;
  }

  @Get('/GetOpenendedQuestionById/:id')
  @ApiOperation({ summary: 'Get the openended question by id' })
  @ApiBearerAuth()
  async getOpenendedQuestionDetails(
    @Param('id') id: number,
    @Res() res
  ) {
    try {
      let [err, success] = await this.contentService.getOpenendedQuestionDetails(id);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('/GetCodingQuestionById/:id')
  @ApiOperation({ summary: 'Get the openended question by id' })
  @ApiBearerAuth()
  async getCodingQuestionDetails(
    @Param('id') id: number,
    @Res() res
  ) {
    try {
      let [err, success] = await this.contentService.getCodingQuestionDetails(id);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('/GetQuizQuestionById/:id')
  @ApiOperation({ summary: 'Get the openended question by id' })
  @ApiBearerAuth()
  async getQuizQuestionDetails(
    @Param('id') id: number,
    @Res() res
  ) {
    try {
      let [err, success] = await this.contentService.getQuizQuestionDetails(id);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Get('/quiz/:quizId')
  @ApiOperation({ summary: 'Get all variants by quizId' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async getAllQuizVariants(@Param('quizId') quizId: number, @Res() res) {
    try {
      const [err, success] = await this.contentService.getAllQuizVariants(quizId);
      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }
      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Post('/quiz/add/variants')
  @ApiOperation({ summary: 'Add variants to a quiz' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async addQuizVariants(
    @Body() addQuizVariantsDto: AddQuizVariantsDto,
    @Res() res
  ) {
    try {
      const [err, success] = await this.contentService.addQuizVariants(addQuizVariantsDto);

      if (err) {
        return ErrorResponse.BadRequestException(err.message).send(res);
      }

      return new SuccessResponse(success.message, success.statusCode, success.data).send(res);
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }


  @Delete('/deleteMainQuizOrVariant')
  @ApiOperation({ summary: 'Delete main quiz or variant' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  async deleteMainQuizOrVariant(
    @Body() deleteDto: deleteQuestionOrVariantDto,
    @Res() res,
  ) {
    const [err, success] = await this.contentService.deleteQuizOrVariant(deleteDto);
    if (err) {
      return ErrorResponse.BadRequestException(err.message, err.statusCode).send(res);
    }
    return new SuccessResponse(success.message, success.statusCode,null).send(res);
  }

  // get complairDateTyeps  
  @Get('/getCompilerTypes')
  @ApiOperation({ summary: 'Get all compiler types' })
  @ApiBearerAuth()
  async getCompilerTypes(
    @Res() res
  ) {
    try {
      return await new SuccessResponse('Compiler types fetched successfully', 200, complairDateTyeps ).send(res);      
    } catch (error) {
      return ErrorResponse.BadRequestException(error.message).send(res);
    }
  }

  @Post('curriculum/upload-pdf')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload a PDF and save its link to a chapter' })
  @ApiQuery({
    name: 'moduleId',
    required: true,
    type: Number,
    description: 'moduleId',
  })
  @ApiQuery({
    name: 'chapterId',
    required: true,
    type: Number,
    description: 'chapterId',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pdf: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('pdf'))
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
    @Query('moduleId') moduleId: number,
    @Query('chapterId') chapterId: number
  ) {
    let url: string;

    try {
      url = await this.contentService.uploadPdfToS3(
        file.buffer,
        file.originalname,
      );
    } catch (err) {
      if (err instanceof InternalServerErrorException) {
        throw err;
      }
      throw new BadGatewayException(
        'Failed to upload PDF to S3',
        { cause: err as Error },
      );
    }
    if (!url) {
      throw new BadGatewayException('S3 returned an empty URL');
    }
    const editDto = new EditChapterDto();
    editDto.links = [url]; 
    const res = await this.contentService.editChapter(
      editDto,
      moduleId,
      chapterId,
    );
    return res;
  }

   @Post('curriculum/upload-images')
@ApiOperation({ summary: 'Upload one or more images to S3' })
@ApiBearerAuth()
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      images: {
        type: 'array',
        items: { type: 'string', format: 'binary' },
      },
    },
  },
})
@UseInterceptors(FilesInterceptor('images', 10))
async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No image files provided');
    }

    // 1) upload each buffer, collecting URLs
    const urls = await Promise.all(
      files.map((file) =>
        this.contentService.uploadImageToS3(
          file.buffer,
          file.originalname
        ),
      ),
    );

    return { urls };
  }
}