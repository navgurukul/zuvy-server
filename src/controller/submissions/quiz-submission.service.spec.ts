// Stub `db` before anything imports it — the real module opens a live
// Postgres connection at import time.
jest.mock('../../db', () => ({
  db: {
    select: jest.fn(),
    query: { zuvyCourseModules: { findMany: jest.fn() } },
  },
}));
jest.mock('src/helpers/studentIds', () => ({
  getStudentIdsByUserId: jest.fn(),
}));

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { db } from '../../db';
import { getStudentIdsByUserId } from 'src/helpers/studentIds';
import { SubmissionService } from './submission.service';
import { SubmissionController } from './submission.controller';
import { QuizChapterScopeGuard } from './quiz-chapter-scope.guard';

// Chainable stand-in for drizzle's query builder; awaiting it at any point
// resolves to `result`.
function makeChain(result: any[]) {
  const chain: any = {};
  for (const m of [
    'from',
    'innerJoin',
    'leftJoin',
    'where',
    'orderBy',
    'groupBy',
  ]) {
    chain[m] = jest.fn(() => chain);
  }
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

// Each db.select() call gets the next result, in call order.
function queueSelects(...results: any[][]) {
  const select = db.select as jest.Mock;
  results.forEach((r) => select.mockImplementationOnce(() => makeChain(r)));
}

const service = new SubmissionService({} as any);

const quizChapter = {
  id: 8570,
  title: 'Quiz Chapter 1',
  topicId: 4,
  quizQuestions: { a: 1, b: 2 },
  moduleId: 1,
  moduleName: 'Module 1',
  bootcampId: 101,
};
const roster = [
  {
    userId: BigInt(123),
    name: 'Prashant',
    email: 'p@x.com',
    batchId: 5,
    batchName: 'Batch 1',
  },
  {
    userId: BigInt(124),
    name: 'Nikita',
    email: 'n@x.com',
    batchId: 5,
    batchName: 'Batch 1',
  },
];
const variants = [
  {
    id: 101,
    quizId: 1,
    question: 'Enter School Type',
    options: { '1': 'Government School', '2': 'Government Aided School' },
    correctOption: 1,
    difficulty: 'Easy',
  },
  {
    id: 201,
    quizId: 2,
    question: 'Q2',
    options: { '1': 'Yes', '2': 'No' },
    correctOption: 2,
    difficulty: 'Easy',
  },
];
const tracking = [
  {
    id: 1,
    userId: 123,
    chapterId: 8570,
    mcqId: 101,
    chosenOption: 1,
    status: 'pass',
    createdAt: '2026-10-07T11:07:00+00:00',
    updatedAt: '2026-10-07T11:07:00+00:00',
  },
  {
    id: 2,
    userId: 123,
    chapterId: 8570,
    mcqId: 201,
    chosenOption: 1,
    status: 'fail',
    createdAt: '2026-10-07T11:07:00+00:00',
    updatedAt: '2026-10-07T11:07:00+00:00',
  },
];

beforeEach(() => {
  jest.resetAllMocks();
  (getStudentIdsByUserId as jest.Mock).mockResolvedValue(
    new Map([['123', '63130']]),
  );
});

describe('SubmissionService.getQuizSubmissionSummary', () => {
  it('rejects an invalid bootcampId', async () => {
    const [err] = await service.getQuizSubmissionSummary(NaN as any);
    expect(err).toMatchObject({ statusCode: 400 });
  });

  it('returns 404 for an unknown bootcamp', async () => {
    queueSelects([]);
    const [err] = await service.getQuizSubmissionSummary(9);
    expect(err).toMatchObject({ statusCode: 404 });
  });

  it('aggregates module-wise counts', async () => {
    queueSelects(
      [{ id: 101, name: 'AEE Career Tours' }],
      [{ count: 2 }],
      [{ chapterId: 8570, submitted: 1 }],
      [], // enrollment EXISTS subquery
    );
    (db.query.zuvyCourseModules.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Module 1', order: 1, moduleChapterData: [quizChapter] },
      { id: 2, name: 'Module 2', order: 2, moduleChapterData: [] },
    ]);

    const [err, result] = await service.getQuizSubmissionSummary(101);
    expect(err).toBeNull();
    expect(result).toMatchObject({
      bootcampName: 'AEE Career Tours',
      totalStudents: 2,
      totalQuizChapters: 1,
      submittedQuizChapters: 1,
      pendingQuizChapters: 0,
      totalSubmissions: 1,
      pendingSubmissions: 1,
      submissionPercentage: 50,
      totalModules: 2,
    });
  });

  it('skips the submissions query when the bootcamp has no quiz chapters', async () => {
    queueSelects([{ id: 101, name: 'B' }], [{ count: 0 }]);
    (db.query.zuvyCourseModules.findMany as jest.Mock).mockResolvedValue([]);
    const [err, result] = await service.getQuizSubmissionSummary(101);
    expect(err).toBeNull();
    expect(result).toMatchObject({ totalQuizChapters: 0, modules: [] });
    expect(db.select).toHaveBeenCalledTimes(2);
  });
});

describe('SubmissionService.getQuizStudentStatus', () => {
  it('requires chapterId', async () => {
    const [err] = await service.getQuizStudentStatus(101, 1, undefined);
    expect(err).toMatchObject({ statusCode: 400 });
  });

  it('returns 404 when the chapter is not a quiz', async () => {
    queueSelects([{ ...quizChapter, topicId: 7 }]);
    const [err] = await service.getQuizStudentStatus(101, 1, 8570);
    expect(err).toMatchObject({ statusCode: 404 });
  });

  it('lists submitted and not submitted students', async () => {
    queueSelects([quizChapter], roster, tracking, variants);
    const [err, result] = await service.getQuizStudentStatus(101, 1, 8570);
    expect(err).toBeNull();
    expect(result).toMatchObject({
      chapterId: 8570,
      totalStudents: 2,
      submittedCount: 1,
      pendingCount: 1,
    });
    expect(result.students).toEqual([
      expect.objectContaining({
        userId: 123,
        studentId: '63130',
        status: 'Submitted',
        marksObtained: 1,
        totalMarks: 2,
      }),
      expect.objectContaining({
        userId: 124,
        studentId: null,
        status: 'Not Submitted',
        submittedAt: null,
      }),
    ]);
  });

  it('handles a chapter nobody has submitted', async () => {
    queueSelects([quizChapter], roster, [], variants);
    const [, result] = await service.getQuizStudentStatus(101, 1, 8570);
    expect(result).toMatchObject({ submittedCount: 0, pendingCount: 2 });
  });
});

describe('SubmissionService.getQuizReport', () => {
  it('requires chapter_id', async () => {
    const [err] = await service.getQuizReport({ chapterId: undefined });
    expect(err).toMatchObject({ statusCode: 400 });
  });

  it('rejects a malformed user_id', async () => {
    const [err] = await service.getQuizReport({
      chapterId: 8570,
      userId: 'abc',
    });
    expect(err).toMatchObject({ statusCode: 400 });
  });

  it('returns 404 when the chapter is not a quiz', async () => {
    queueSelects([{ ...quizChapter, topicId: 7 }]);
    const [err] = await service.getQuizReport({ chapterId: 8570 });
    expect(err).toMatchObject({ statusCode: 404 });
  });

  it('reports all students, submitted and pending, when no student is given', async () => {
    queueSelects([quizChapter], roster, tracking, variants);
    const [err, result] = await service.getQuizReport({ chapterId: 8570 });
    expect(err).toBeNull();
    expect(result).toMatchObject({
      bootcampId: 101,
      chapterId: 8570,
      chapterTitle: 'Quiz Chapter 1',
      totalStudents: 2,
      submittedCount: 1,
      pendingCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    const [submitted, pending] = result.students;
    expect(submitted).toMatchObject({
      userId: 123,
      studentId: '63130',
      submissionStatus: 'Submitted',
      submittedAt: '2026-10-07T11:07:00+00:00',
      quiz: { chapterId: 8570, totalMarks: 2, marksObtained: 1 },
    });
    expect(submitted.quiz.questions[0]).toMatchObject({
      question: 'Enter School Type',
      questionType: 'Multiple Choice',
      options: [
        { optionId: 1, optionText: 'Government School' },
        { optionId: 2, optionText: 'Government Aided School' },
      ],
      chosenOptions: [{ optionId: 1, optionText: 'Government School' }],
      correctOptions: [{ optionId: 1, optionText: 'Government School' }],
      marksObtained: 1,
    });
    expect(pending).toMatchObject({
      userId: 124,
      submissionStatus: 'Not Submitted',
      submittedAt: null,
      quiz: null,
    });
  });

  it('reports a single student by user_id', async () => {
    queueSelects([quizChapter], [roster[1]], [], variants);
    const [err, result] = await service.getQuizReport({
      chapterId: 8570,
      userId: '124',
    });
    expect(err).toBeNull();
    expect(result).toMatchObject({
      totalStudents: 1,
      submittedCount: 0,
      pendingCount: 1,
    });
    expect(result.students).toEqual([
      expect.objectContaining({
        userId: 124,
        submissionStatus: 'Not Submitted',
        quiz: null,
      }),
    ]);
  });

  it('reports a single student by student_id', async () => {
    queueSelects(
      [{ userId: BigInt(123) }],
      [quizChapter],
      [roster[0]],
      tracking,
      variants,
    );
    const [err, result] = await service.getQuizReport({
      chapterId: 8570,
      studentId: '63130',
    });
    expect(err).toBeNull();
    expect(result.students.map((s) => s.userId)).toEqual([123]);
    expect(result.students[0].submissionStatus).toBe('Submitted');
  });

  it('accepts student_id and user_id of the same student', async () => {
    queueSelects(
      [{ userId: BigInt(123) }],
      [quizChapter],
      [roster[0]],
      tracking,
      variants,
    );
    const [err] = await service.getQuizReport({
      chapterId: 8570,
      studentId: '63130',
      userId: '123',
    });
    expect(err).toBeNull();
  });

  it('rejects student_id and user_id of different students', async () => {
    queueSelects([{ userId: BigInt(123) }]);
    const [err] = await service.getQuizReport({
      chapterId: 8570,
      studentId: '63130',
      userId: '124',
    });
    expect(err).toMatchObject({ statusCode: 400 });
  });

  it('returns 404 for an unknown student_id', async () => {
    queueSelects([]);
    const [err] = await service.getQuizReport({
      chapterId: 8570,
      studentId: 'NOPE',
    });
    expect(err).toMatchObject({ statusCode: 404 });
  });

  it('returns 404 when the student is not enrolled in the bootcamp or batch', async () => {
    queueSelects([quizChapter], [], [], variants);
    const [err] = await service.getQuizReport({
      chapterId: 8570,
      userId: '999',
      batchId: 5,
    });
    expect(err).toMatchObject({ statusCode: 404 });
  });

  it('paginates and sorts the all-student report', async () => {
    queueSelects([quizChapter], roster, tracking, variants);
    const [, result] = await service.getQuizReport({
      chapterId: 8570,
      page: 2,
      pageSize: 1,
      orderBy: 'name',
      orderDirection: 'asc',
    });
    expect(result).toMatchObject({
      page: 2,
      pageSize: 1,
      totalPages: 2,
      totalStudents: 2,
    });
    expect(result.students.map((s) => s.name)).toEqual(['Prashant']);
  });

  it('caps page_size at 100', async () => {
    queueSelects([quizChapter], roster, tracking, variants);
    const [, result] = await service.getQuizReport({
      chapterId: 8570,
      pageSize: 5000,
    });
    expect(result.pageSize).toBe(100);
  });
});

describe('QuizChapterScopeGuard', () => {
  const guard = new QuizChapterScopeGuard();
  const ctx = (request: any) =>
    ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;

  it('requires a valid chapter_id', async () => {
    await expect(guard.canActivate(ctx({ query: {} }))).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      guard.canActivate(ctx({ query: { chapter_id: 'x' } })),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns 404 for an unknown chapter', async () => {
    queueSelects([]);
    await expect(
      guard.canActivate(ctx({ query: { chapter_id: '1' } })),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a bootcamp_id the chapter does not belong to', async () => {
    queueSelects([{ bootcampId: 101 }]);
    await expect(
      guard.canActivate(
        ctx({ query: { chapter_id: '8570', bootcamp_id: '7' } }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('exposes the chapter bootcamp to PermissionsGuard', async () => {
    queueSelects([{ bootcampId: 101 }]);
    const request: any = { query: { chapter_id: '8570' }, params: {} };
    await expect(guard.canActivate(ctx(request))).resolves.toBe(true);
    expect(request.params.bootcampId).toBe(101);
  });
});

describe('SubmissionController quiz endpoints', () => {
  const controller = new SubmissionController({} as any);
  let res: any;
  beforeEach(() => {
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  it('forbids students', async () => {
    await expect(
      controller.getQuizSubmissionSummary(
        101,
        { user: [{ roles: ['student'] }] },
        res,
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.getQuizReport({ user: [{ roles: [] }] }, res, 8570),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets admins through', async () => {
    const svc = {
      getQuizReport: jest.fn().mockResolvedValue([null, { ok: true }]),
    };
    await new SubmissionController(svc as any).getQuizReport(
      { user: [{ roles: ['admin'] }] },
      res,
      8570,
      '123',
      '63130',
    );
    expect(svc.getQuizReport).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterId: 8570,
        userId: '123',
        studentId: '63130',
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('passes service errors through with their status code', async () => {
    const svc = {
      getQuizReport: jest
        .fn()
        .mockResolvedValue([
          { message: 'Student not found', statusCode: 404 },
          null,
        ]),
    };
    await new SubmissionController(svc as any).getQuizReport(
      { user: [{ roles: ['instructor'] }] },
      res,
      8570,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
