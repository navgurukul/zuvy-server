// Auto-generated tests focusing on recent changes: lockContent, createQuizForModule, calculateQuestionScores, editAssessment date/state logic,
// getAllQuizQuestions, getAllCodingQuestions, editQuizQuestion, updateAssessmentState, getQuizQuestionsByAllDifficulties,
// getAssessmentDetailsOfQuiz, deleteQuizOrVariant.
// Framework: Jest (+ @nestjs/testing if applicable). Adjust imports according to project setup.

/* 
  Test Framework: Jest (with potential NestJS @nestjs/testing utilities if service requires DI).
  These tests target functions highlighted in the diff and aim to cover happy paths, edge cases, and failure conditions.
  External dependencies like 'db', 'sql', and model tables are mocked. Adjust import paths to actual project structure.
*/

import { TestingModule, Test } from '@nestjs/testing';
// Adjust the import path according to repository structure:

import { ContentService } from './content.service'; // If path differs, update accordingly.

// Fallback types to satisfy TS in test context if not available in test runtime.
// Replace with actual imports when present.

type CreateQuizzesDto = any;
type EditQuizBatchDto = any;
type CreateAssessmentBody = any;

// Mocks for db and ORM utilities used in the service
// Depending on actual implementation, you may need to mock from their modules instead.

const mockDb = {
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  select: jest.fn(),
  query: {
    zuvyModuleQuiz: { findMany: jest.fn(), findFirst: jest.fn() },
    zuvyModuleQuizVariants: { findMany: jest.fn() },
    zuvyCodingQuestions: { findMany: jest.fn() },
    zuvyOutsourseAssessments: { findFirst: jest.fn(), findMany: jest.fn() },
  },
  execute: jest.fn(),
};
const sql: any = (...args: any[]) => ({ sql: args });
const inArray: any = jest.fn((col, arr) => ({ in: [col, arr] }));
const eq: any = jest.fn((a, b) => ({ eq: [a, b] }));
const and: any = (...conds: any[]) => ({ and: conds });

// Table placeholders for mocking

const zuvyModuleQuiz: any = { id: 'zuvyModuleQuiz.id', difficulty: 'zuvyModuleQuiz.difficulty', tagId: 'zuvyModuleQuiz.tagId', usage: 'zuvyModuleQuiz.usage', isRandomOptions: 'zuvyModuleQuiz.isRandomOptions' };
const zuvyModuleQuizVariants: any = { id: 'zuvyModuleQuizVariants.id', quizId: 'zuvyModuleQuizVariants.quizId', variantNumber: 'zuvyModuleQuizVariants.variantNumber' };
const zuvyCodingQuestions: any = { id: 'zuvyCodingQuestions.id', title: 'zuvyCodingQuestions.title', difficulty: 'zuvyCodingQuestions.difficulty', tagId: 'zuvyCodingQuestions.tagId', usage: 'zuvyCodingQuestions.usage' };
const zuvyOutsourseAssessments: any = { id: 'zuvyOutsourseAssessments.id' };
const zuvyModuleChapter: any = { id: 'zuvyModuleChapter.id' };
const zuvyCourseModules: any = { id: 'zuvyCourseModules.id' };
const zuvyModuleAssessment: any = { id: 'zuvyModuleAssessment.id' };
const zuvyOutsourseQuizzes: any = { id: 'zuvyOutsourseQuizzes.id', quiz_id: 'zuvyOutsourseQuizzes.quiz_id', assessmentOutsourseId: 'zuvyOutsourseQuizzes.assessmentOutsourseId' };
const zuvyOutsourseOpenEndedQuestions: any = { id: 'zuvyOutsourseOpenEndedQuestions.id', openEndedQuestionId: 'zuvyOutsourseOpenEndedQuestions.openEndedQuestionId', assessmentOutsourseId: 'zuvyOutsourseOpenEndedQuestions.assessmentOutsourseId' };
const zuvyOpenEndedQuestions: any = { id: 'zuvyOpenEndedQuestions.id', usage: 'zuvyOpenEndedQuestions.usage' };
const zuvyOutsourseCodingQuestions: any = { id: 'zuvyOutsourseCodingQuestions.id', codingQuestionId: 'zuvyOutsourseCodingQuestions.codingQuestionId', assessmentOutsourseId: 'zuvyOutsourseCodingQuestions.assessmentOutsourseId' };
const Logger = { error: jest.fn(), log: jest.fn() };

const helperVariable = {
  MCQ_POINTS: { Easy: 1, Medium: 2, Hard: 3 },
  CODING_POINTS: { Easy: 2, Medium: 3, Hard: 5 },
  TOTAL_SCORE: 100,
};

const STATUS_CODES = {
  CREATED: 201,
  OK: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404
};

// Wire up chained mock shapes commonly used in service
function mockInsertReturning(returned: any[] = []) {
  const returning = jest.fn().mockResolvedValue(returned);
  return { values: jest.fn().mockReturnValue({ returning }) };
}
function mockUpdateReturning(returned: any[] = []) {
  const returning = jest.fn().mockResolvedValue(returned);
  return { set: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ returning }) }) };
}
function mockDeleteReturning(returned: any[] = []) {
  const returning = jest.fn().mockResolvedValue(returned);
  return { where: jest.fn().mockReturnValue({ returning }) };
}
function mockSelectFrom(returned: any[] = []) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(returned),
      execute: jest.fn().mockResolvedValue(returned),
      limit: jest.fn().mockReturnValue({}),
    }),
  };
}

jest.mock('../../../../path/to/db', () => ({ // Update path to actual db module if present
  db: mockDb,
  sql,
  inArray,
  eq,
  and
}), { virtual: true });

// If ContentService reads these from modules, consider using jest.mock with correct paths.

describe('ContentService (focused tests from diff)', () => {
  let service: any;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T12:00:00Z'));
    jest.clearAllMocks();

    // Provide service with mocked dependencies. Update providers/injections as per actual service constructor.
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: 'DB', useValue: mockDb },
        { provide: 'LOGGER', useValue: Logger },
        { provide: 'HELPER_VARIABLE', useValue: helperVariable },
        ContentService,
      ],
    }).compile();

    service = module.get(ContentService);
    // Inject helpers if service uses properties; adjust to actual implementation
    if (service) {
      service.db = mockDb;
      service.helperVariable = helperVariable;
      service.STATUS_CODES = STATUS_CODES;
      service.sql = sql;
      service.inArray = inArray;
      service.eq = eq;
      service.and = and;

      // Also attach table refs if used directly
      service.zuvyModuleQuiz = zuvyModuleQuiz;
      service.zuvyModuleQuizVariants = zuvyModuleQuizVariants;
      service.zuvyCodingQuestions = zuvyCodingQuestions;
      service.zuvyOutsourseAssessments = zuvyOutsourseAssessments;
      service.zuvyModuleChapter = zuvyModuleChapter;
      service.zuvyCourseModules = zuvyCourseModules;
      service.zuvyModuleAssessment = zuvyModuleAssessment;
      service.zuvyOutsourseQuizzes = zuvyOutsourseQuizzes;
      service.zuvyOutsourseOpenEndedQuestions = zuvyOutsourseOpenEndedQuestions;
      service.zuvyOpenEndedQuestions = zuvyOpenEndedQuestions;
      service.zuvyOutsourseCodingQuestions = zuvyOutsourseCodingQuestions;
      service.Logger = Logger;
    }
  });

  describe('lockContent', () => {
    it('should lock first module and lock next only if current progress >= 100', async () => {
      const modules = [
        { id: 1, progress: 10 },
        { id: 2, progress: 0 },
        { id: 3, progress: 100 },
        { id: 4, progress: 0 },
      ];
      const output = await service.lockContent([...modules]);
      expect(output[0].lock).toBe(true);
      // since first progress is not >= 100, next should be unlocked
      expect(output[1].lock).toBe(false);
      // third's lock depends on second's progress
      expect(output[2].lock).toBe(false);
      // fourth's lock depends on third's progress (100)
      expect(output[3].lock).toBe(true);
    });

    it('should handle single-element arrays', async () => {
      const modules = [{ id: 1, progress: 0 }];
      const output = await service.lockContent([...modules]);
      expect(output[0].lock).toBe(true);
      expect(output).toHaveLength(1);
    });

    it('should not throw on empty arrays', async () => {
      const output = await service.lockContent([]);
      expect(output).toEqual([]);
    });
  });

  describe('createQuizForModule', () => {
    it('should validate required fields and return BAD_REQUEST for invalid data', async () => {
      const dto: CreateQuizzesDto = {
        quizzes: [
          { difficulty: undefined, tagId: null }, // invalid
        ],
      };

      const [err, ok] = await service.createQuizForModule(dto);
      expect(ok).toBeNull();
      expect(err).toEqual({ message: 'All fields are required', statusCode: STATUS_CODES.BAD_REQUEST });
    });

    it('should insert quizzes and their variants, returning CREATED with data', async () => {
      const dto: CreateQuizzesDto = {
        quizzes: [
          {
            title: 'Q1',
            difficulty: 'Easy',
            tagId: 7,
            content: 'about',
            isRandomOptions: true,
            variantMCQs: [
              {
                question: 'What is 2+2?',
                options: { A: '3', B: '4' },
                correctOption: 'B',
              },
              {
                question: 'What is 3+3?',
                options: { A: '6', B: '7' },
                correctOption: 'A',
              },
            ],
          },
        ],
      };

      // Mock DB insertions
      const insertedQuizzesRows = [{ id: 101, difficulty: 'Easy', tagId: 7, content: 'about', isRandomOptions: true }];
      mockDb.insert.mockImplementation((table: any) => {
        if (table === zuvyModuleQuiz) return mockInsertReturning(insertedQuizzesRows);
        if (table === zuvyModuleQuizVariants) return mockInsertReturning([{ id: 1 }]);
        return mockInsertReturning([]);
      });

      const [err, ok] = await service.createQuizForModule(dto);

      expect(err).toBeNull();
      expect(ok.statusCode).toBe(STATUS_CODES.CREATED);
      expect(ok.data).toHaveLength(1);
      expect(ok.data[0].variantMCQs).toHaveLength(2);
      // Ensure variantNumber mapping
      expect(ok.data[0].variantMCQs[0].variantNumber).toBe(1);
      expect(ok.data[0].variantMCQs[1].variantNumber).toBe(2);
    });

    it('should catch and wrap thrown errors', async () => {
      mockDb.insert.mockImplementation(() => { throw new Error('DB down'); });
      const dto: CreateQuizzesDto = { quizzes: [{ difficulty: 'Easy', tagId: 1, variantMCQs: [] }] };
      const [err, ok] = await service.createQuizForModule(dto);
      expect(ok).toBeNull();
      expect(err).toEqual({ message: 'DB down', statusCode: STATUS_CODES.BAD_REQUEST });
    });
  });

  describe('calculateQuestionScores', () => {
    it('should proportionally distribute MCQ scores based on difficulty and weightage', async () => {
      const totalScore = 100;
      const weightage = 60; // 60% of total
      const counts = { easy: 2, medium: 1, hard: 1 }; // weights 1,2,3 -> 2*1 + 1*2 + 1*3 = 7
      const scores = await service.calculateQuestionScores(totalScore, weightage, counts, 'MCQ');
      const sectionScore = 60;
      const totalWeight = 2*helperVariable.MCQ_POINTS.Easy + 1*helperVariable.MCQ_POINTS.Medium + 1*helperVariable.MCQ_POINTS.Hard; // 2*1 + 1*2 + 1*3 = 7
      expect(scores.easy).toBeCloseTo((helperVariable.MCQ_POINTS.Easy / totalWeight) * sectionScore, 6);
      expect(scores.medium).toBeCloseTo((helperVariable.Medium ?? helperVariable.MCQ_POINTS.Medium) / totalWeight * sectionScore, 6);
      expect(scores.hard).toBeCloseTo((helperVariable.Hard ?? helperVariable.MCQ_POINTS.Hard) / totalWeight * sectionScore, 6);
    });

    it('should return zero scores when no questions are present', async () => {
      const scores = await service.calculateQuestionScores(100, 50, { easy: 0, medium: 0, hard: 0 }, 'MCQ');
      expect(scores).toEqual({ easy: 0, medium: 0, hard: 0 });
    });

    it('should use CODING_POINTS when type is Coding', async () => {
      const scores = await service.calculateQuestionScores(100, 50, { easy: 1, medium: 0, hard: 0 }, 'Coding');
      // entire section score goes to easy if only easy present
      expect(scores.easy).toBeCloseTo(50, 6);
      expect(scores.medium).toBe(0);
      expect(scores.hard).toBe(0);
    });
  });

  describe('editAssessment - date and state validations', () => {
    beforeEach(() => {
      // Default happy path mocks for existence checks
      mockDb.select.mockImplementation(() => ({
        from: (tbl: any) => ({
          where: async (_: any) => {
            if (tbl === zuvyModuleChapter) return [{ id: 5, moduleId: 9 }];
            if (tbl === zuvyCourseModules) return [{ id: 9 }];
            return [];
          },
        }),
      }));

      // Query for existing assessment
      mockDb.query.zuvyOutsourseAssessments.findMany.mockResolvedValue([{
        id: 10, bootcampId: 1, moduleId: 9, chapterId: 5,
        ModuleAssessment: { id: 20 },
        OutsourseQuizzes: [],
        OutsourseOpenEndedQuestions: [],
        OutsourseCodingQuestions: []
      }]);
      // Updates
      mockDb.update.mockImplementation((tbl: any) => mockUpdateReturning([{ id: 1 }]));
      // Deletes
      mockDb.delete.mockImplementation((tbl: any) => mockDeleteReturning([{ id: 1 }]));
      // Inserts
      mockDb.insert.mockImplementation((tbl: any) => mockInsertReturning([{ id: 1 }]));
    });

    it('should throw when total weightage is not 100', async () => {
      const body: CreateAssessmentBody = {
        weightageCodingQuestions: 30,
        weightageMcqQuestions: 60, // 90 total
        passPercentage: 50,
        mcqIds: [],
        openEndedQuestionIds: [],
        codingProblemIds: [],
      };
      await expect(service.editAssessment(10, body, 5)).rejects.toEqual(expect.objectContaining({
        status: 'error',
        statusCode: 404,
        message: 'The total weightage must equal 100.',
      }));
    });

    it('should throw when passPercentage > 100', async () => {
      const body: CreateAssessmentBody = {
        weightageCodingQuestions: 50,
        weightageMcqQuestions: 50,
        passPercentage: 120,
        mcqIds: [],
        openEndedQuestionIds: [],
        codingProblemIds: [],
      };
      await expect(service.editAssessment(10, body, 5)).rejects.toEqual(expect.objectContaining({
        status: 'error',
        statusCode: 404,
        message: 'Pass percentage cannot be greater than 100.',
      }));
    });

    it('should validate publish/start/end ordering and set currentState accordingly', async () => {
      const base: any = {
        weightageCodingQuestions: 50,
        weightageMcqQuestions: 50,
        passPercentage: 60,
        mcqIds: [],
        openEndedQuestionIds: [],
        codingProblemIds: [],
      };

      // Invalid: start < publish
      await expect(service.editAssessment(10, {
        ...base,
        publishDatetime: '2024-01-02T00:00:00.000Z',
        startDatetime: '2024-01-01T00:00:00.000Z',
      }, 5)).rejects.toEqual(expect.objectContaining({
        statusCode: 400,
        message: 'startDatetime must be greater than or equal to publishDatetime'
      }));

      // Invalid: end <= start
      await expect(service.editAssessment(10, {
        ...base,
        publishDatetime: '2023-12-25T00:00:00.000Z',
        startDatetime: '2023-12-26T00:00:00.000Z',
        endDatetime: '2023-12-26T00:00:00.000Z',
      }, 5)).rejects.toEqual(expect.objectContaining({
        statusCode: 400,
        message: 'endDatetime must be greater than startDatetime'
      }));

      // Valid: DRAFT if now < publish
      jest.setSystemTime(new Date('2023-12-24T00:00:00.000Z'));
      await expect(service.editAssessment(10, {
        ...base,
        publishDatetime: '2023-12-25T00:00:00.000Z',
      }, 5)).resolves.toEqual(expect.objectContaining({
        status: 'success',
        code: 200
      }));

      // Valid: PUBLISHED if now between publish and start
      jest.setSystemTime(new Date('2023-12-25T12:00:00.000Z'));
      await expect(service.editAssessment(10, {
        ...base,
        publishDatetime: '2023-12-25T00:00:00.000Z',
        startDatetime: '2023-12-26T00:00:00.000Z',
      }, 5)).resolves.toEqual(expect.objectContaining({ status: 'success' }));

      // Valid: ACTIVE if now between start and end
      jest.setSystemTime(new Date('2023-12-26T12:00:00.000Z'));
      await expect(service.editAssessment(10, {
        ...base,
        publishDatetime: '2023-12-25T00:00:00.000Z',
        startDatetime: '2023-12-26T00:00:00.000Z',
        endDatetime: '2023-12-27T00:00:00.000Z',
      }, 5)).resolves.toEqual(expect.objectContaining({ status: 'success' }));

      // Valid: CLOSED if now > end
      jest.setSystemTime(new Date('2023-12-28T00:00:00.000Z'));
      await expect(service.editAssessment(10, {
        ...base,
        publishDatetime: '2023-12-25T00:00:00.000Z',
        startDatetime: '2023-12-26T00:00:00.000Z',
        endDatetime: '2023-12-27T00:00:00.000Z',
      }, 5)).resolves.toEqual(expect.objectContaining({ status: 'success' }));
    });
  });

  describe('getAllQuizQuestions', () => {
    beforeEach(() => {
      mockDb.query.zuvyModuleQuizVariants.findMany.mockResolvedValue([{ quizId: 1 }, { quizId: 2 }]);
      mockDb.query.zuvyModuleQuiz.findMany
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]) // for totalCount
        .mockResolvedValueOnce([
          { id: 3, quizVariants: [{ id: 30, question: 'hello world?' }] },
          { id: 2, quizVariants: [{ id: 20, question: 'hello nest?' }] },
        ]);
    });

    it('should return paginated results with totalRows and totalPages using tagId and difficulty filters', async () => {
      const res = await service.getAllQuizQuestions([1,2], ['Easy','Medium'], 'hello', 10, 0);
      expect(res.totalRows).toBe(3);
      expect(res.totalPages).toBe(1);
      expect(Array.isArray(res.data)).toBe(true);
      expect(mockDb.query.zuvyModuleQuiz.findMany).toHaveBeenCalled();
    });

    it('should handle no search term path', async () => {
      mockDb.query.zuvyModuleQuiz.findMany.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([{ id: 1 }]);
      const res = await service.getAllQuizQuestions(1, 'Easy', '', 5, 0);
      expect(res.totalRows).toBe(1);
      expect(res.totalPages).toBe(1);
    });
  });

  describe('getAllCodingQuestions', () => {
    beforeEach(() => {
      mockDb.select.mockImplementation(() => mockSelectFrom([{ count: 4 }]));
      mockDb.query.zuvyCodingQuestions.findMany.mockResolvedValue([
        { id: 10, title: 'Title A' },
        { id: 9, title: 'Another' },
      ]);
    });

    it('should return results with totalRows and totalPages', async () => {
      const res = await service.getAllCodingQuestions([1,2], ['Easy', 'Medium'], 'tit', 2, 0);
      expect(res.totalRows).toBe(4);
      expect(res.totalPages).toBe(2);
      expect(res.data.length).toBeGreaterThan(0);
    });

    it('should support no searchTerm and NaN limit (totalPages = 1)', async () => {
      const res = await service.getAllCodingQuestions(1, 'Easy', '', NaN as any, 0);
      expect(res.totalPages).toBe(1);
    });
  });

  describe('editQuizQuestion', () => {
    it('should update provided quiz fields and variants, returning OK with data', async () => {
      mockDb.update.mockImplementation((tbl: any) => {
        if (tbl === zuvyModuleQuiz || tbl === zuvyModuleQuizVariants) return { set: jest.fn().mockReturnValue({ where: jest.fn() }) };
        return { set: jest.fn() };
      });

      const dto: EditQuizBatchDto = {
        id: 55,
        title: 'New Title',
        difficulty: 'Hard',
        tagId: 99,
        content: 'Updated',
        isRandomOptions: true,
        variantMCQs: [
          { variantNumber: 1, question: 'Q1', options: { A: 1 }, correctOption: 'A' },
          { variantNumber: 2, question: 'Q2', options: { A: 2 }, correctOption: 'A' },
        ],
      };

      const [err, ok] = await service.editQuizQuestion(dto);
      expect(err).toBeNull();
      expect(ok.statusCode).toBe(STATUS_CODES.OK);
      expect(ok.data.quizDetails).toMatchObject({
        title: 'New Title',
        difficulty: 'Hard',
        tagId: 99,
        content: 'Updated',
        isRandomOptions: true
      });
      expect(ok.data.variantMCQs).toHaveLength(2);
    });

    it('should wrap thrown errors', async () => {
      mockDb.update.mockImplementation(() => { throw new Error('update failed'); });
      const [err, ok] = await service.editQuizQuestion({ id: 1, title: 'X' });
      expect(ok).toBeNull();
      expect(err).toEqual({ message: 'update failed', statusCode: STATUS_CODES.BAD_REQUEST });
    });
  });

  describe('updateAssessmentState', () => {
    beforeEach(() => {
      mockDb.update.mockImplementation(() => mockUpdateReturning([{ id: 1 }]));
    });

    it('should not update when state unchanged', async () => {
      jest.setSystemTime(new Date('2023-12-24T00:00:00.000Z'));
      const assessment = { id: 1, currentState: 0, publishDatetime: '2025-01-01T00:00:00.000Z' }; // now < publish => newState 0
      await service.updateAssessmentState(assessment);
      // update should not be called if unchanged
      expect(mockDb.update).toHaveBeenCalledTimes(0);
    });

    it('should update to ACTIVE between start and end', async () => {
      jest.setSystemTime(new Date('2023-12-26T12:00:00.000Z'));
      const assessment = {
        id: 1,
        currentState: 1,
        publishDatetime: '2023-12-25T00:00:00.000Z',
        startDatetime: '2023-12-26T00:00:00.000Z',
        endDatetime: '2023-12-27T00:00:00.000Z',
      };
      await service.updateAssessmentState(assessment);
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('getQuizQuestionsByAllDifficulties', () => {
    it('should aggregate by difficulty and call getQuizQuestionsByDifficulty with correct params', async () => {
      const spy = jest.spyOn(service, 'getQuizQuestionsByDifficulty').mockImplementation(async () => [{ quizId: 1 }]);
      const quizConfig = { easyMcqQuestions: 1, mediumMcqQuestions: 2, hardMcqQuestions: 3, mcqTagId: 77 };
      const [err, result] = await service.getQuizQuestionsByAllDifficulties(10, quizConfig, 200, 300);
      expect(err).toBeNull();
      expect(Object.keys(result)).toEqual(['easy', 'medium', 'hard']);
      expect(spy).toHaveBeenCalledTimes(3);
      expect(spy).toHaveBeenCalledWith('Easy', 10, 1, 77, 200, 300);
      expect(spy).toHaveBeenCalledWith('Medium', 10, 2, 77, 200, 300);
      expect(spy).toHaveBeenCalledWith('Hard', 10, 3, 77, 200, 300);
    });

    it('should return error tuple when internal call throws', async () => {
      jest.spyOn(service, 'getQuizQuestionsByDifficulty').mockRejectedValue(new Error('boom'));
      const [err, result] = await service.getQuizQuestionsByAllDifficulties(10, {}, 1, 2);
      expect(err).toBeInstanceOf(Error);
      expect(result).toEqual({});
    });
  });

  describe('getAssessmentDetailsOfQuiz', () => {
    beforeEach(() => {
      mockDb.query.zuvyOutsourseAssessments.findFirst.mockResolvedValue({
        id: 9,
        easyMcqMark: 1.4,
        mediumMcqMark: 2.6,
        hardMcqMark: 3.9,
        submitedOutsourseAssessments: [{ id: 123 }],
      });
      jest.spyOn(service, 'getQuizQuestionsByAllDifficulties').mockResolvedValue([null, {
        easy: [{ quizId: 1, quizTitle: 'Q1', variantId: 11, question: 'q', options: {}, correctOption: 'A', variantNumber: 1, assessmentId: 99 }],
        medium: [{ quizId: 2, quizTitle: 'Q2', variantId: 22, question: 'q2', options: {}, correctOption: 'B', variantNumber: 1, assessmentId: 98 }],
        hard: [],
      }]);
    });

    it('should flatten questions with marks per difficulty', async () => {
      const [err, ok] = await service.getAssessmentDetailsOfQuiz(9, { roles: [] }, 10, true);
      expect(err).toBeNull();
      expect(ok.statusCode).toBe(STATUS_CODES.OK);
      expect(ok.data.mcqs.length).toBe(2);
      const easy = ok.data.mcqs.find((m) => m.quizId === 1);
      const medium = ok.data.mcqs.find((m) => m.quizId === 2);
      expect(easy.mark).toBe(Math.floor(1.4));
      expect(medium.mark).toBe(Math.floor(2.6));
    });

    it('should return BAD_REQUEST when inner call returns error tuple', async () => {
      (service.getQuizQuestionsByAllDifficulties as jest.Mock).mockResolvedValue([new Error('inner'), {}]);
      const [err, ok] = await service.getAssessmentDetailsOfQuiz(9, { roles: [] }, 10, true);
      expect(err).toBeNull();
      expect(ok.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
    });
  });

  describe('deleteQuizOrVariant', () => {
    beforeEach(() => {
      mockDb.select.mockImplementation((...args: any[]) => ({
        from: (tbl: any) => ({
          where: async (cond: any) => {
            // simulate used quizzes when selecting from zuvyModuleQuiz with usage > 0
            if (tbl === zuvyModuleQuiz) {
              if (String(cond).includes('usage')) {
                return [{ id: 2, usage: 3 }];
              }
              return [{ usage: 0 }];
            }
            if (tbl === zuvyModuleQuizVariants) {
              return [{ quizId: 10, variantNumber: 2 }];
            }
            return [{ id: 1 }];
          },
          limit: (_: any) => [{ quizId: 10 }],
        }),
      }));
      mockDb.delete.mockImplementation((tbl: any) => mockDeleteReturning([{ id: 1 }]));
      mockDb.update.mockImplementation((tbl: any) => mockUpdateReturning([{ id: 1 }]));
    });

    it('should delete main quizzes not in use and reject those with usage > 0', async () => {
      const dto = {
        questionIds: [
          { id: 1, type: 'main' },
          { id: 2, type: 'main' }, // simulate used
        ],
      };
      const [err, ok] = await service.deleteQuizOrVariant(dto);
      // When used quiz exists, method returns BAD_REQUEST and no success payload
      expect(ok).toBeNull();
      expect(err.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(String(err.message)).toMatch(/cannot be deleted/i);
    });

    it('should prevent deleting last remaining variant', async () => {
      // Make variant count return one
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: async () => [{ quizId: 10 }], // variant lookup
          limit: () => [{ quizId: 10 }],
        }),
      })).mockImplementationOnce(() => ({
        from: () => ({
          where: async () => ([{ id: 100 }]), // usedQuiz check
          limit: () => ([{ usage: 0 }]),
        }),
      })).mockImplementationOnce(() => ({
        from: () => ({
          where: async () => ([{ id: 1 }]), // variantCount: only 1
        }),
      }));

      const dto = {
        questionIds: [{ id: 999, type: 'variant' }],
      };
      const [err, ok] = await service.deleteQuizOrVariant(dto);
      expect(ok).toBeNull();
      expect(err.statusCode).toBe(STATUS_CODES.BAD_REQUEST);
      expect(String(err.message)).toMatch(/last remaining variant/);
    });

    it('should delete a variant and renumber remaining', async () => {
      // variantCount returns >1 this time
      mockDb.select.mockImplementation((...args: any[]) => ({
        from: (tbl: any) => ({
          where: async (cond: any) => {
            if (tbl === zuvyModuleQuizVariants) {
              // First request for count (return two variants), later for target (return variantNumber=2)
              if (String(cond).includes('quizId')) return [{ id: 1 }, { id: 2 }];
              return [{ variantNumber: 2 }];
            }
            if (tbl === zuvyModuleQuiz) {
              return [{ usage: 0 }];
            }
            return [{ id: 1 }];
          },
          limit: (_: any) => [{ quizId: 10 }],
        }),
      }));

      const dto = {
        questionIds: [{ id: 1001, type: 'variant' }],
      };
      const [err, ok] = await service.deleteQuizOrVariant(dto);
      expect(err).toBeNull();
      expect(ok.statusCode).toBe(STATUS_CODES.OK);
      // Ensure update for renumbering variants was called
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});