/**
 * Unit tests for ContentController.
 * Framework: Jest with @nestjs/testing (NestJS standard).
 * These tests focus on critical controller logic present in the PR diff:
 * - Role fallback in getChapterDetailsById
 * - File upload endpoints (uploadPdf, uploadImages) including success and failure paths
 * - Representative argument wiring checks for thin endpoints (deleteProject, createChapter)
 * - Success/error flow for startAssessmentForStudent using response wrappers
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ContentController } from './content.controller';

// Create a minimal mock for ContentService used by controller methods.
// Methods not directly used in focused tests can remain undefined to catch accidental calls.
const createContentServiceMock = () => ({
  createModuleForCourse: jest.fn(),
  createProjectForCourse: jest.fn(),
  getProjectDetails: jest.fn(),
  updateProjectDetails: jest.fn(),
  deleteProjectForBootcamp: jest.fn(),
  createChapterForModule: jest.fn(),
  createQuizForModule: jest.fn(),
  editAssessment: jest.fn(),
  getAllModuleByBootcampId: jest.fn(),
  getAllChaptersOfModule: jest.fn(),
  getChapterDetailsById: jest.fn(),
  updateOrderOfModules: jest.fn(),
  deleteModule: jest.fn(),
  editChapter: jest.fn(),
  deleteChapter: jest.fn(),
  getAllQuizQuestions: jest.fn(),
  updateCodingProblemForModule: jest.fn(),
  getAllCodingQuestions: jest.fn(),
  deleteCodingProblem: jest.fn(),
  editQuizQuestion: jest.fn(),
  deleteQuiz: jest.fn(),
  createTag: jest.fn(),
  getAllTags: jest.fn(),
  getAllOpenEndedQuestions: jest.fn(),
  updateOpenEndedQuestion: jest.fn(),
  createOpenEndedQuestions: jest.fn(),
  deleteOpenEndedQuestion: jest.fn(),
  getStudentsOfAssessment: jest.fn(),
  startAssessmentForStudent: jest.fn(),
  getAssessmentDetailsOfQuiz: jest.fn(),
  getAssessmentDetailsOfOpenEnded: jest.fn(),
  createQuestionType: jest.fn(),
  getAllQuestionTypes: jest.fn(),
  createFormForModule: jest.fn(),
  getAllFormQuestions: jest.fn(),
  editFormQuestions: jest.fn(),
  createAndEditFormQuestions: jest.fn(),
  getOpenendedQuestionDetails: jest.fn(),
  getCodingQuestionDetails: jest.fn(),
  getQuizQuestionDetails: jest.fn(),
  getAllQuizVariants: jest.fn(),
  addQuizVariants: jest.fn(),
  deleteQuizOrVariant: jest.fn(),

  // S3 upload helpers used by new endpoints
  uploadPdfToS3: jest.fn(),
  uploadImageToS3: jest.fn(),
});

// Minimal Response stub to capture send() style used by SuccessResponse/ErrorResponse wrappers
const createResStub = () => {
  const resObj: any = {};
  resObj.sent = undefined;
  resObj.status = jest.fn().mockReturnValue(resObj);
  resObj.json = jest.fn().mockImplementation((body) => {
    resObj.sent = body;
    return resObj;
  });
  resObj.send = jest.fn().mockImplementation((body) => {
    resObj.sent = body;
    return resObj;
  });
  return resObj;
};

describe('ContentController (unit)', () => {
  // Note on testing framework: Using Jest with @nestjs/testing.
  let controller: ContentController;
  let contentService: ReturnType<typeof createContentServiceMock>;

  beforeEach(async () => {
    contentService = createContentServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [
        { provide: 'ContentService', useValue: contentService },
      ],
    })
      // In Nest typical provider token is the class itself; try both binding styles.
      .overrideProvider('ContentService')
      .useValue(contentService)
      .compile();

    // If provider token is the class itself:
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { ContentService } = require('../../service/content/content.service');
      module.overrideProvider(ContentService).useValue(contentService);
    } catch {
      // ignore if service path differs; above string-token mock will suffice for direct constructor injection.
    }

    // Retrieve the controller instance
    controller = module.get(ContentController);
    // Manually inject service if constructor injection used with class token
    try {
      // @ts-ignore
      controller['contentService'] = contentService;
    } catch {
      // ignore
    }
  });

  describe('getChapterDetailsById', () => {
    it('should pass role from req.user[0].role when present', async () => {
      contentService.getChapterDetailsById.mockResolvedValueOnce({ ok: true });
      const req = { user: [{ role: 'admin' }] };
      const result = await controller.getChapterDetailsById(
        11, // chapterId
        22, // bootcampId
        33, // moduleId
        44, // topicId
        req as any
      );
      expect(contentService.getChapterDetailsById).toHaveBeenCalledWith(11, 22, 33, 44, 'admin');
      expect(result).toEqual({ ok: true });
    });

    it("should fallback role to 'student' when req.user is missing or empty", async () => {
      contentService.getChapterDetailsById.mockResolvedValueOnce({ ok: true });
      const req = { user: [] }; // empty array
      const result = await controller.getChapterDetailsById(1, 2, 3, 4, req as any);
      expect(contentService.getChapterDetailsById).toHaveBeenCalledWith(1, 2, 3, 4, 'student');
      expect(result).toEqual({ ok: true });
    });
  });

  describe('uploadPdf', () => {
    const moduleId = 101;
    const chapterId = 202;

    it('should upload pdf, set reOrder.links, and call editChapter (happy path)', async () => {
      const buffer = Buffer.from('pdfdata');
      const file = { buffer, originalname: 'test.pdf' } as any;
      contentService.uploadPdfToS3.mockResolvedValueOnce('https://s3/url.pdf');
      contentService.editChapter.mockResolvedValueOnce({ updated: true });

      const result = await controller.uploadPdf(file, moduleId as any, chapterId as any, { links: [] } as any);

      expect(contentService.uploadPdfToS3).toHaveBeenCalledWith(buffer, 'test.pdf');
      expect(contentService.editChapter).toHaveBeenCalledWith(
        { links: ['https://s3/url.pdf'] },
        moduleId,
        chapterId
      );
      expect(result).toEqual({ updated: true });
    });

    it('should call editChapter without modifying links when file is not provided', async () => {
      contentService.editChapter.mockResolvedValueOnce({ updated: true });

      const reOrder = { links: ['kept'] } as any;
      const result = await controller.uploadPdf(undefined as any, moduleId as any, chapterId as any, reOrder);

      expect(contentService.uploadPdfToS3).not.toHaveBeenCalled();
      expect(contentService.editChapter).toHaveBeenCalledWith(reOrder, moduleId, chapterId);
      expect(result).toEqual({ updated: true });
    });

    it('should wrap non-InternalServerErrorException errors into BadGatewayException', async () => {
      const file = { buffer: Buffer.from('x'), originalname: 'a.pdf' } as any;
      contentService.uploadPdfToS3.mockRejectedValueOnce(new Error('network'));

      await expect(
        controller.uploadPdf(file, moduleId as any, chapterId as any, { } as any)
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('should rethrow InternalServerErrorException from uploadPdfToS3', async () => {
      const file = { buffer: Buffer.from('x'), originalname: 'a.pdf' } as any;
      contentService.uploadPdfToS3.mockRejectedValueOnce(new InternalServerErrorException('s3 down'));

      await expect(
        controller.uploadPdf(file, moduleId as any, chapterId as any, {} as any)
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('should throw BadGatewayException when S3 returns empty URL', async () => {
      const file = { buffer: Buffer.from('x'), originalname: 'a.pdf' } as any;
      contentService.uploadPdfToS3.mockResolvedValueOnce('');

      await expect(
        controller.uploadPdf(file, moduleId as any, chapterId as any, {} as any)
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });

  describe('uploadImages', () => {
    it('should throw BadRequestException when no files provided', async () => {
      await expect(controller.uploadImages(undefined as any)).rejects.toBeInstanceOf(BadRequestException);
      await expect(controller.uploadImages([] as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should upload all images and return urls (happy path)', async () => {
      const files = [
        { buffer: Buffer.from('a'), originalname: 'a.png' },
        { buffer: Buffer.from('b'), originalname: 'b.png' },
      ] as any;
      contentService.uploadImageToS3
        .mockResolvedValueOnce('https://s3/a.png')
        .mockResolvedValueOnce('https://s3/b.png');

      const result = await controller.uploadImages(files);

      expect(contentService.uploadImageToS3).toHaveBeenNthCalledWith(1, files[0].buffer, 'a.png');
      expect(contentService.uploadImageToS3).toHaveBeenNthCalledWith(2, files[1].buffer, 'b.png');
      expect(result).toEqual({ urls: ['https://s3/a.png', 'https://s3/b.png'] });
    });

    it('should propagate error if one of the uploads fails', async () => {
      const files = [
        { buffer: Buffer.from('a'), originalname: 'a.png' },
        { buffer: Buffer.from('b'), originalname: 'b.png' },
      ] as any;
      contentService.uploadImageToS3
        .mockResolvedValueOnce('https://s3/a.png')
        .mockRejectedValueOnce(new Error('s3 error'));

      await expect(controller.uploadImages(files)).rejects.toBeInstanceOf(Error);
    });
  });

  describe('deleteProject (argument wiring)', () => {
    it('should pass (projectId, moduleId, bootcampId) in correct order', async () => {
      contentService.deleteProjectForBootcamp.mockResolvedValueOnce({ deleted: true });

      const result = await controller.deleteProject(55 as any, 66 as any, 77 as any);

      expect(contentService.deleteProjectForBootcamp).toHaveBeenCalledWith(55, 66, 77);
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('createChapter (argument wiring)', () => {
    it('should call createChapterForModule with moduleId, topicId, bootcampId', async () => {
      contentService.createChapterForModule.mockResolvedValueOnce({ created: true });
      const dto = { moduleId: 9, topicId: 8, bootcampId: 7 } as any;

      const result = await controller.createChapter(dto);

      expect(contentService.createChapterForModule).toHaveBeenCalledWith(9, 8, 7);
      expect(result).toEqual({ created: true });
    });
  });

  describe('startAssessmentForStudent (service happy and error path via res)', () => {
    it('should return success response when service returns [null, success]', async () => {
      const res = createResStub();
      const success = { message: 'ok', statusCode: 200, data: { id: 1 } };
      contentService.startAssessmentForStudent.mockResolvedValueOnce([null, success]);

      const req = { user: [{ id: 99 } ] };
      // Note: The method returns the value returned by SuccessResponse(...).send(res).
      // We can't assert internals of wrappers; we assert service called with args and that res.send/json is eventually called.
      const out = await controller.startAssessmentForStudent(req as any, 123 as any, true as any, res as any);

      expect(contentService.startAssessmentForStudent).toHaveBeenCalledWith(123, true, req.user[0]);
      // Depending on wrapper, either res.send or res.json is used. We assert one was called.
      expect(res.send.mock.calls.length + res.json.mock.calls.length).toBeGreaterThan(0);
      expect(out).toBeDefined();
    });

    it('should return error response when service returns [err, null]', async () => {
      const res = createResStub();
      const err = { message: 'bad', statusCode: 400 };
      contentService.startAssessmentForStudent.mockResolvedValueOnce([err, null]);

      const req = { user: [{ id: 1 }] };
      const out = await controller.startAssessmentForStudent(req as any, 1 as any, false as any, res as any);

      expect(res.send.mock.calls.length + res.json.mock.calls.length).toBeGreaterThan(0);
      expect(out).toBeDefined();
    });
  });
});