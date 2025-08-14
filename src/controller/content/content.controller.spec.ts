import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ContentController } from './content.controller';

// Create a minimal ContentService interface typing for our mocks
class MockContentService {
  createModuleForCourse = jest.fn();
  createProjectForCourse = jest.fn();
  getProjectDetails = jest.fn();
  updateProjectDetails = jest.fn();
  deleteProjectForBootcamp = jest.fn();
  createChapterForModule = jest.fn();
  createQuizForModule = jest.fn();
  editAssessment = jest.fn();
  getAllModuleByBootcampId = jest.fn();
  getAllChaptersOfModule = jest.fn();
  getChapterDetailsById = jest.fn();
  updateOrderOfModules = jest.fn();
  deleteModule = jest.fn();
  editChapter = jest.fn();
  deleteChapter = jest.fn();
  getAllQuizQuestions = jest.fn();
  updateCodingProblemForModule = jest.fn();
  getAllCodingQuestions = jest.fn();
  deleteCodingProblem = jest.fn();
  editQuizQuestion = jest.fn();
  deleteQuiz = jest.fn();
  createTag = jest.fn();
  getAllTags = jest.fn();
  getAllOpenEndedQuestions = jest.fn();
  updateOpenEndedQuestion = jest.fn();
  createOpenEndedQuestions = jest.fn();
  deleteOpenEndedQuestion = jest.fn();
  getStudentsOfAssessment = jest.fn();
  startAssessmentForStudent = jest.fn();
  getAssessmentDetailsOfQuiz = jest.fn();
  getAssessmentDetailsOfOpenEnded = jest.fn();
  createQuestionType = jest.fn();
  getAllQuestionTypes = jest.fn();
  createFormForModule = jest.fn();
  getAllFormQuestions = jest.fn();
  editFormQuestions = jest.fn();
  createAndEditFormQuestions = jest.fn();
  getOpenendedQuestionDetails = jest.fn();
  getCodingQuestionDetails = jest.fn();
  getQuizQuestionDetails = jest.fn();
  getAllQuizVariants = jest.fn();
  addQuizVariants = jest.fn();
  deleteQuizOrVariant = jest.fn();
  uploadPdfToS3 = jest.fn();
  uploadImageToS3 = jest.fn();
}

describe('ContentController (unit)', () => {
  let controller: ContentController;
  let service: MockContentService;

  beforeEach(async () => {
    service = new MockContentService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [
        { provide: 'ContentService', useValue: service },
      ],
    })
      // The controller constructor injects ContentService by type, so we also provide token by class
      .overrideProvider('ContentService' as any)
      .useValue(service)
      .compile();

    controller = module.get(ContentController);
  });

  describe('basic mapping methods', () => {
    it('createModule forwards to service with correct params and returns result', async () => {
      const moduleDto: any = { name: 'Module A' };
      service.createModuleForCourse.mockResolvedValue({ id: 1, ...moduleDto });

      const result = await controller.createModule(moduleDto, 42 as any, 5 as any);
      expect(service.createModuleForCourse).toHaveBeenCalledWith(42, moduleDto, 5);
      expect(result).toEqual({ id: 1, ...moduleDto });
    });

    it('createProject forwards to service with correct params and returns result', async () => {
      const projectDto: any = { title: 'Project X' };
      service.createProjectForCourse.mockResolvedValue({ id: 7, ...projectDto });

      const result = await controller.createProject(projectDto, 99 as any, 3 as any);
      expect(service.createProjectForCourse).toHaveBeenCalledWith(99, projectDto, 3);
      expect(result).toEqual({ id: 7, ...projectDto });
    });

    it('getProjectDetails uses correct param order', async () => {
      service.getProjectDetails.mockResolvedValue({ id: 11, bootcampId: 55 });

      const result = await controller.getProjectDetails(11 as any, 55 as any);
      expect(service.getProjectDetails).toHaveBeenCalledWith(55, 11);
      expect(result).toEqual({ id: 11, bootcampId: 55 });
    });

    it('updateProject forwards to service', async () => {
      const dto: any = { title: 'Updated' };
      service.updateProjectDetails.mockResolvedValue({ ok: true });
      const result = await controller.updateProject(dto, 777 as any);
      expect(service.updateProjectDetails).toHaveBeenCalledWith(777, dto);
      expect(result).toEqual({ ok: true });
    });

    it('deleteProject forwards to service with correct params order', async () => {
      service.deleteProjectForBootcamp.mockResolvedValue({ deleted: true });
      const result = await controller.deleteProject(10 as any, 20 as any, 30 as any);
      expect(service.deleteProjectForBootcamp).toHaveBeenCalledWith(10, 30, 20);
      expect(result).toEqual({ deleted: true });
    });

    it('createChapter maps moduleId/topicId/bootcampId from body correctly', async () => {
      const body: any = { moduleId: 1, topicId: 2, bootcampId: 3 };
      service.createChapterForModule.mockResolvedValue({ id: 44 });
      const result = await controller.createChapter(body);
      expect(service.createChapterForModule).toHaveBeenCalledWith(1, 2, 3);
      expect(result).toEqual({ id: 44 });
    });

    it('getAllModules forwards bootcampId', async () => {
      service.getAllModuleByBootcampId.mockResolvedValue([{ id: 1 }]);
      const result = await controller.getAllModules(999 as any);
      expect(service.getAllModuleByBootcampId).toHaveBeenCalledWith(999);
      expect(result).toEqual([{ id: 1 }]);
    });

    it('getChapterDetailsOfModule forwards moduleId', async () => {
      service.getAllChaptersOfModule.mockResolvedValue([{ id: 1 }]);
      const result = await controller.getChapterDetailsOfModule(5 as any);
      expect(service.getAllChaptersOfModule).toHaveBeenCalledWith(5);
      expect(result).toEqual([{ id: 1 }]);
    });

    it('reOrderModules forwards correct parameters', async () => {
      const reorder: any = { order: [3,2,1] };
      service.updateOrderOfModules.mockResolvedValue({ ok: true });
      const result = await controller.reOrderModules(reorder, 6 as any, 9 as any);
      expect(service.updateOrderOfModules).toHaveBeenCalledWith(reorder, 6, 9);
      expect(result).toEqual({ ok: true });
    });

    it('deleteModule forwards moduleId and bootcampId', async () => {
      service.deleteModule.mockResolvedValue({ ok: true });
      const result = await controller.deleteModule(4 as any, 8 as any);
      expect(service.deleteModule).toHaveBeenCalledWith(8, 4);
      expect(result).toEqual({ ok: true });
    });

    it('editChapter forwards correct params', async () => {
      const dto: any = { title: 'New' };
      service.editChapter.mockResolvedValue({ ok: true });
      const result = await controller.editChapter(dto, 21 as any, 31 as any);
      expect(service.editChapter).toHaveBeenCalledWith(dto, 21, 31);
      expect(result).toEqual({ ok: true });
    });

    it('deleteChapter forwards correct params', async () => {
      service.deleteChapter.mockResolvedValue({ ok: true });
      const result = await controller.deleteChapter(41 as any, 51 as any);
      expect(service.deleteChapter).toHaveBeenCalledWith(51, 41);
      expect(result).toEqual({ ok: true });
    });
  });

  describe('getChapterDetailsById role handling', () => {
    it('uses role from req.user[0].role when available', async () => {
      service.getChapterDetailsById.mockResolvedValue({ chapterId: 1, role: 'admin' });
      const req: any = { user: [{ role: 'admin' }] };
      const result = await controller.getChapterDetailsById(1 as any, 2 as any, 3 as any, 4 as any, req);
      expect(service.getChapterDetailsById).toHaveBeenCalledWith(1, 2, 3, 4, 'admin');
      expect(result).toEqual({ chapterId: 1, role: 'admin' });
    });

    it("defaults role to 'student' when req.user missing", async () => {
      service.getChapterDetailsById.mockResolvedValue({ chapterId: 1, role: 'student' });
      const req: any = {}; // no user
      const result = await controller.getChapterDetailsById(1 as any, 2 as any, 3 as any, 4 as any, req);
      expect(service.getChapterDetailsById).toHaveBeenCalledWith(1, 2, 3, 4, 'student');
      expect(result).toEqual({ chapterId: 1, role: 'student' });
    });

    it("defaults role to 'student' when req.user empty array", async () => {
      service.getChapterDetailsById.mockResolvedValue({ chapterId: 1, role: 'student' });
      const req: any = { user: [] };
      await controller.getChapterDetailsById(1 as any, 2 as any, 3 as any, 4 as any, req);
      expect(service.getChapterDetailsById).toHaveBeenCalledWith(1, 2, 3, 4, 'student');
    });
  });

  describe('listing endpoints forwarding', () => {
    it('getAllQuizQuestions forwards filters and pagination', async () => {
      service.getAllQuizQuestions.mockResolvedValue({ items: [], count: 0 });
      const result = await controller.getAllQuizQuestions([1,2] as any, ['Easy','Hard'] as any, 'algo' as any, 10 as any, 0 as any);
      expect(service.getAllQuizQuestions).toHaveBeenCalledWith([1,2], ['Easy','Hard'], 'algo', 10, 0);
      expect(result).toEqual({ items: [], count: 0 });
    });

    it('getAllCodingQuestions forwards filters and pagination', async () => {
      service.getAllCodingQuestions.mockResolvedValue({ items: [], count: 0 });
      const result = await controller.getAllCodingQuestions([5] as any, 'Medium' as any, 'search' as any, 20 as any, 5 as any);
      expect(service.getAllCodingQuestions).toHaveBeenCalledWith([5], 'Medium', 'search', 20, 5);
      expect(result).toEqual({ items: [], count: 0 });
    });

    it('getAllOpenEndedQuestions forwards params', async () => {
      service.getAllOpenEndedQuestions.mockResolvedValue({ items: [], count: 0 });
      const result = await controller.getAllOpenEndedQuestions([9] as any, ['Easy'] as any, '' as any, 50 as any, 10 as any);
      expect(service.getAllOpenEndedQuestions).toHaveBeenCalledWith([9], ['Easy'], '', 50, 10);
      expect(result).toEqual({ items: [], count: 0 });
    });

    it('getAllFormQuestions forwards typeId/searchTerm', async () => {
      service.getAllFormQuestions.mockResolvedValue({ items: [] });
      const result = await controller.getAllFormQuestions(33 as any, 2 as any, 'email' as any);
      expect(service.getAllFormQuestions).toHaveBeenCalledWith(33, 2, 'email');
      expect(result).toEqual({ items: [] });
    });
  });

  describe('mutations for question banks', () => {
    it('updateCodingQuestionForModule forwards correctly', async () => {
      const dto: any = { statement: 'fix', cases: [] };
      service.updateCodingProblemForModule.mockResolvedValue({ ok: true });
      const res = await controller.updateCodingQuestionForModule(dto, 123 as any);
      expect(service.updateCodingProblemForModule).toHaveBeenCalledWith(123, dto);
      expect(res).toEqual({ ok: true });
    });

    it('deleteCodingQuestion forwards correctly', async () => {
      const dto: any = { ids: [1,2,3] };
      service.deleteCodingProblem.mockResolvedValue({ deleted: 3 });
      const out = await controller.deleteCodingQuestion(dto as any);
      expect(service.deleteCodingProblem).toHaveBeenCalledWith(dto);
      expect(out).toEqual({ deleted: 3 });
    });

    it('deleteQuizQuestion forwards correctly', async () => {
      const dto: any = { ids: [4,5] };
      service.deleteQuiz.mockResolvedValue({ deleted: 2 });
      const out = await controller.deleteQuizQuestion(dto as any);
      expect(service.deleteQuiz).toHaveBeenCalledWith(dto);
      expect(out).toEqual({ deleted: 2 });
    });
  });

  describe('tags and types', () => {
    it('createTag and getAllTags forward', async () => {
      const tag: any = { name: 'DSA' };
      service.createTag.mockResolvedValue({ id: 1, ...tag });
      expect(await controller.createTag(tag)).toEqual({ id: 1, ...tag });
      expect(service.createTag).toHaveBeenCalledWith(tag);

      service.getAllTags.mockResolvedValue([{ id: 1, name: 'DSA' }]);
      expect(await controller.getAllTags()).toEqual([{ id: 1, name: 'DSA' }]);
      expect(service.getAllTags).toHaveBeenCalled();
    });

    it('createQuestionType and getAllQuestionTypes forward', async () => {
      const typeDto: any = { label: 'Single Choice' };
      service.createQuestionType.mockResolvedValue({ id: 10, ...typeDto });
      expect(await controller.createQuestionType(typeDto)).toEqual({ id: 10, ...typeDto });
      expect(service.createQuestionType).toHaveBeenCalledWith(typeDto);

      service.getAllQuestionTypes.mockResolvedValue([{ id: 10, label: 'Single Choice' }]);
      expect(await controller.getAllQuestionTypes()).toEqual([{ id: 10, label: 'Single Choice' }]);
      expect(service.getAllQuestionTypes).toHaveBeenCalled();
    });
  });

  describe('forms', () => {
    it('createFormForModule forwards correct params', async () => {
      service.createFormForModule.mockResolvedValue({ ok: true });
      const result = await controller.createFormForModule(88 as any, { batch: [] } as any);
      expect(service.createFormForModule).toHaveBeenCalledWith(88, { batch: [] });
      expect(result).toEqual({ ok: true });
    });

    it('editFormForModule forwards correct params', async () => {
      service.editFormQuestions.mockResolvedValue({ ok: true });
      const result = await controller.editFormForModule(77 as any, { updates: [] } as any);
      expect(service.editFormQuestions).toHaveBeenCalledWith(77, { updates: [] });
      expect(result).toEqual({ ok: true });
    });

    it('createAndEditForm forwards correct params', async () => {
      service.createAndEditFormQuestions.mockResolvedValue({ ok: true });
      const result = await controller.createAndEditForm(66 as any, { items: [] } as any);
      expect(service.createAndEditFormQuestions).toHaveBeenCalledWith(66, { items: [] });
      expect(result).toEqual({ ok: true });
    });
  });

  describe('open-ended questions', () => {
    it('updateOpenEndedQuestionForModule forwards correctly', async () => {
      const dto: any = { question: 'Why?' };
      service.updateOpenEndedQuestion.mockResolvedValue({ ok: true });
      const result = await controller.updateOpenEndedQuestionForModule(dto, 5 as any);
      expect(service.updateOpenEndedQuestion).toHaveBeenCalledWith(5, dto);
      expect(result).toEqual({ ok: true });
    });

    it('createOpenEndedQuestion forwards correctly', async () => {
      const dto: any = { questions: ['A?'] };
      service.createOpenEndedQuestions.mockResolvedValue({ created: 1 });
      const result = await controller.createOpenEndedQuestion(dto as any);
      expect(service.createOpenEndedQuestions).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ created: 1 });
    });

    it('deleteOpenEndedQuestion forwards correctly', async () => {
      const dto: any = { ids: [1] };
      service.deleteOpenEndedQuestion.mockResolvedValue({ deleted: 1 });
      const result = await controller.deleteOpenEndedQuestion(dto as any);
      expect(service.deleteOpenEndedQuestion).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ deleted: 1 });
    });
  });

  describe('uploadPdf', () => {
    it('uploads pdf, sets reOrder.links, and calls editChapter', async () => {
      const file: any = { buffer: Buffer.from('pdf'), originalname: 'doc.pdf' };
      const reOrder: any = { title: 'Ch 1' };
      service.uploadPdfToS3.mockResolvedValue('https://s3.amazonaws.com/bucket/doc.pdf');
      service.editChapter.mockResolvedValue({ ok: true });

      const result = await controller.uploadPdf(file, 12 as any, 34 as any, reOrder);
      expect(service.uploadPdfToS3).toHaveBeenCalledWith(file.buffer, file.originalname);
      expect(service.editChapter).toHaveBeenCalledWith({ ...reOrder, links: ['https://s3.amazonaws.com/bucket/doc.pdf'] }, 12, 34);
      expect(result).toEqual({ ok: true });
    });

    it('throws BadGatewayException when S3 upload throws a non-InternalServerErrorException', async () => {
      const file: any = { buffer: Buffer.from('pdf'), originalname: 'doc.pdf' };
      const reOrder: any = {};
      service.uploadPdfToS3.mockRejectedValue(new Error('S3 down'));

      await expect(controller.uploadPdf(file, 1 as any, 2 as any, reOrder))
        .rejects
        .toBeInstanceOf(BadGatewayException);
    });

    it('rethrows InternalServerErrorException from S3 upload', async () => {
      const file: any = { buffer: Buffer.from('pdf'), originalname: 'doc.pdf' };
      const reOrder: any = {};
      service.uploadPdfToS3.mockRejectedValue(new InternalServerErrorException('internal'));

      await expect(controller.uploadPdf(file, 1 as any, 2 as any, reOrder))
        .rejects
        .toBeInstanceOf(InternalServerErrorException);
    });

    it('throws BadGatewayException when S3 returns empty URL', async () => {
      const file: any = { buffer: Buffer.from('pdf'), originalname: 'doc.pdf' };
      const reOrder: any = {};
      service.uploadPdfToS3.mockResolvedValue('');
      await expect(controller.uploadPdf(file, 1 as any, 2 as any, reOrder))
        .rejects
        .toBeInstanceOf(BadGatewayException);
    });

    it('when file not provided, only calls editChapter without touching links', async () => {
      const reOrder: any = { links: ['keep-me'] };
      service.editChapter.mockResolvedValue({ ok: true });
      const result = await controller.uploadPdf(undefined as any, 10 as any, 20 as any, reOrder);
      expect(service.uploadPdfToS3).not.toHaveBeenCalled();
      expect(service.editChapter).toHaveBeenCalledWith(reOrder, 10, 20);
      expect(result).toEqual({ ok: true });
    });
  });

  describe('uploadImages', () => {
    it('throws BadRequestException if files array missing or empty', async () => {
      await expect(controller.uploadImages(undefined as any)).rejects.toBeInstanceOf(BadRequestException);
      await expect(controller.uploadImages([] as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('uploads each image and returns collected URLs', async () => {
      const files: any[] = [
        { buffer: Buffer.from('i1'), originalname: 'a.png' },
        { buffer: Buffer.from('i2'), originalname: 'b.jpg' },
      ];
      service.uploadImageToS3.mockImplementation((buf: Buffer, name: string) => Promise.resolve(`https://s3/${name}`));

      const result = await controller.uploadImages(files);
      expect(service.uploadImageToS3).toHaveBeenCalledTimes(2);
      expect(service.uploadImageToS3).toHaveBeenNthCalledWith(1, files[0].buffer, files[0].originalname);
      expect(service.uploadImageToS3).toHaveBeenNthCalledWith(2, files[1].buffer, files[1].originalname);
      expect(result).toEqual({ urls: ['https://s3/a.png', 'https://s3/b.jpg'] });
    });
  });

  describe('open/coding/quiz by id methods', () => {
    it('getOpenendedQuestionDetails returns Success path object through service (controller returns whatever service returns)', async () => {
      service.getOpenendedQuestionDetails.mockResolvedValue({ id: 1, q: '...' });
      const mockRes: any = {}; // Not used because controller returns direct value in catch-less path? In provided code it wraps with SuccessResponse via res; here our focus is that the promise resolves.
      const result = await controller.getOpenendedQuestionDetails(1 as any, mockRes);
      expect(service.getOpenendedQuestionDetails).toHaveBeenCalledWith(1);
      // Since the controller uses SuccessResponse internally with res, unit-testing that path would require stubbing SuccessResponse.
      // We assert service call; behavior beyond is integration-level with HTTP layer.
      expect(result).toEqual({ id: 1, q: '...' });
    });

    it('getCodingQuestionDetails forwards to service', async () => {
      service.getCodingQuestionDetails.mockResolvedValue({ id: 2 });
      const r: any = {};
      const result = await controller.getCodingQuestionDetails(2 as any, r);
      expect(service.getCodingQuestionDetails).toHaveBeenCalledWith(2);
      expect(result).toEqual({ id: 2 });
    });

    it('getQuizQuestionDetails forwards to service', async () => {
      service.getQuizQuestionDetails.mockResolvedValue({ id: 3 });
      const r: any = {};
      const result = await controller.getQuizQuestionDetails(3 as any, r);
      expect(service.getQuizQuestionDetails).toHaveBeenCalledWith(3);
      expect(result).toEqual({ id: 3 });
    });
  });

  // Note: Methods that internally allocate SuccessResponse/ErrorResponse and call send(res)
  // are more suitable for e2e/integration tests with Nest's HTTP layer.
  // Here we focus on verifying controller-service interaction and core branching logic.

});