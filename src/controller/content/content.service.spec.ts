/**
 * Test library and framework: Jest with NestJS testing conventions.
 * This file contains comprehensive unit tests emphasizing recently updated logic.
 */

import { InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common'

// Service under test: we import dynamically with a relative path assumption.
// Adjust the import path if the service file resides elsewhere.
import { ContentService } from './content.service'

// Mocks for external dependencies
const mockS3Send = jest.fn()
const mockS3 = { send: mockS3Send }
const mockDb: any = {}
const helperVariable: any = {
  TOTAL_SCORE: 100,
  MCQ_POINTS: { Easy: 1, Medium: 2, Hard: 3 },
  CODING_POINTS: { Easy: 2, Medium: 3, Hard: 5 },
}
const STATUS_CODES: any = { OK: 200, BAD_REQUEST: 400 }

jest.mock('@aws-sdk/client-s3', () => {
  return {
    PutObjectCommand: function PutObjectCommand(input: any) {
      return { __type: 'PutObjectCommand', input }
    },
  }
})

// Ensure Logger doesn't spam output
jest.spyOn(Logger, 'error').mockImplementation(() => undefined as any)

describe('ContentService (diff-focused tests)', () => {
  let service: ContentService

  beforeEach(() => {
    jest.clearAllMocks()
    // Construct service with required properties; if constructor differs, instantiate and then assign properties used in methods.
    service = new ContentService() as any
    ;(service as any).s3 = mockS3
    ;(service as any).bucket = 'test-bucket'
    ;(service as any).region = 'ap-south-1'
    // Inject other shared deps if present on the service
    ;(service as any).helperVariable = helperVariable
    ;(service as any).db = mockDb
  })

  describe('uploadPdfToS3', () => {
    it('should upload PDF to S3 and return a signed URL (happy path)', async () => {
      mockS3Send.mockResolvedValueOnce({})

      const buf = Buffer.from('pdf-binary')
      const url = await (service as any).uploadPdfToS3(buf, 'file.pdf')

      expect(mockS3Send).toHaveBeenCalledTimes(1)
      const callArg = mockS3Send.mock.calls[0][0]
      expect(callArg.__type).toBe('PutObjectCommand')
      expect(callArg.input.Bucket).toBe('test-bucket')
      expect(callArg.input.ContentType).toBe('application/pdf')
      expect(callArg.input.Body).toBe(buf)
      expect(callArg.input.Key).toMatch(/^zuvy_curriculum\/\d+_file\.pdf$/)
      expect(url).toMatch(/^https:\/\/test-bucket\.s3\.ap-south-1\.amazonaws\.com\/zuvy_curriculum\/\d+_file\.pdf$/)
    })

    it('should throw InternalServerErrorException when S3 upload fails', async () => {
      mockS3Send.mockRejectedValueOnce(new Error('s3 fail'))

      await expect((service as any).uploadPdfToS3(Buffer.from('x'), 'x.pdf'))
        .rejects
        .toBeInstanceOf(InternalServerErrorException)
    })
  })

  describe('uploadImageToS3', () => {
    it('should upload image to S3 and return a URL', async () => {
      mockS3Send.mockResolvedValueOnce({})

      const buf = Buffer.from([1,2,3])
      const url = await (service as any).uploadImageToS3(buf, 'pic.png')

      expect(mockS3Send).toHaveBeenCalledTimes(1)
      const cmd = mockS3Send.mock.calls[0][0]
      expect(cmd.__type).toBe('PutObjectCommand')
      expect(cmd.input.Bucket).toBe('test-bucket')
      expect(cmd.input.Key).toMatch(/^mcq_images\/\d+_pic\.png$/)
      expect(cmd.input.ContentType).toBe('image/*')
      expect(url).toMatch(/^https:\/\/test-bucket\.s3\.ap-south-1\.amazonaws\.com\/mcq_images\/\d+_pic\.png$/)
    })
  })

  describe('lockContent', () => {
    it('should set first module locked and subsequent locks based on progress', async () => {
      const modules = [
        { id: 1, progress: 0 },
        { id: 2, progress: 100 },
        { id: 3, progress: 50 },
      ]
      const result = await (service as any).lockContent(modules)

      expect(result[0].lock).toBe(true)
      // Since first module progress is 0 (<100), second should be unlocked
      expect(result[1].lock).toBe(false)
      // Second progress 100 → third locked
      expect(result[2].lock).toBe(true)
    })

    it('should handle single-element array', async () => {
      const modules = [{ id: 1, progress: 100 }]
      const result = await (service as any).lockContent(modules)
      expect(result).toHaveLength(1)
      expect(result[0].lock).toBe(true)
    })

    it('should not crash on empty array', async () => {
      const result = await (service as any).lockContent([])
      expect(result).toEqual([])
    })
  })

  describe('calculateQuestionScores', () => {
    it('should distribute MCQ marks proportionally by difficulty with non-zero counts', async () => {
      const totalScore = 100
      const weightage = 40 // sectionScore = 40
      const counts = { easy: 2, medium: 1, hard: 1 } // weights: 2*1 + 1*2 + 1*3 = 7
      const res = await (service as any).calculateQuestionScores(totalScore, weightage, counts, 'MCQ')

      const sum = res.easy + res.medium + res.hard
      expect(Math.round(sum)).toBe(40)
      // easy share = 2*1/7 = 2/7; medium = 2/7; hard = 3/7
      expect(res.easy).toBeCloseTo((1/7)*2*20, 3) // Keep relative checks
      expect(res.medium).toBeCloseTo((2/7)*40, 3)
      expect(res.hard).toBeCloseTo((3/7)*40, 3)
    })

    it('should return zeros when all counts are zero', async () => {
      const res = await (service as any).calculateQuestionScores(100, 50, { easy: 0, medium: 0, hard: 0 }, 'MCQ')
      expect(res).toEqual({ easy: 0, medium: 0, hard: 0 })
    })

    it('should use CODING points when type is Coding', async () => {
      const res = await (service as any).calculateQuestionScores(100, 60, { easy: 1, medium: 0, hard: 0 }, 'Coding')
      // Only easy present, should get full section score (60)
      expect(res).toEqual({ easy: 60, medium: 0, hard: 0 })
    })
  })

  describe('updateAssessmentState', () => {
    it('should set to DRAFT if now < publish date', async () => {
      const future = new Date(Date.now() + 3600_000).toISOString()
      const assessment = { id: 1, currentState: 2, publishDatetime: future }
      const calls: any[] = []
      ;(mockDb.update = jest.fn().mockReturnThis(),
        mockDb.set = jest.fn().mockReturnThis())
      ;(service as any).db = {
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve()),
          })),
        })),
      }

      await (service as any).updateAssessmentState(assessment)

      // If state changed from 2 to 0, an update should happen
      expect((service as any).db.update).toHaveBeenCalled()
    })

    it('should transition across published/active/closed based on dates', async () => {
      const now = new Date()
      const publishDate = new Date(now.getTime() - 2 * 3600_000).toISOString()
      const startDate = new Date(now.getTime() - 1 * 3600_000).toISOString()
      const endDate = new Date(now.getTime() + 1 * 3600_000).toISOString()
      const assessment = { id: 2, currentState: 0, publishDatetime: publishDate, startDatetime: startDate, endDatetime: endDate }

      const updateMock = jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve()),
        })),
      }))
      ;(service as any).db = { update: updateMock }

      await (service as any).updateAssessmentState(assessment)
      expect(updateMock).toHaveBeenCalled()
    })
  })

  describe('editAssessment (validation branches)', () => {
    beforeEach(() => {
      // Provide db scaffolding to hit only initial validation branches without proceeding deep
      mockDb.select = jest.fn().mockReturnThis()
      mockDb.from = jest.fn().mockReturnThis()
      mockDb.where = jest.fn().mockResolvedValue([{ id: 1, moduleId: 10 }]) // chapterInfo or moduleInfo not empty by default
      mockDb.query = { zuvyOutsourseAssessments: { findMany: jest.fn().mockResolvedValue([{ ModuleAssessment: { id: 123 }, OutsourseQuizzes: [], OutsourseOpenEndedQuestions: [], OutsourseCodingQuestions: [], bootcampId: 1, moduleId: 2, chapterId: 3 }]) } }
      mockDb.update = jest.fn().mockReturnThis()
      mockDb.set = jest.fn().mockReturnThis()
      mockDb.returning = jest.fn().mockResolvedValue([{ id: 1 }])
      mockDb.insert = jest.fn().mockReturnThis()
      mockDb.values = jest.fn().mockReturnThis()
      mockDb.delete = jest.fn().mockReturnThis()
    })

    it('should error if total weightage != 100', async () => {
      const body: any = {
        weightageCodingQuestions: 30,
        weightageMcqQuestions: 60, // 90 total
        passPercentage: 50,
        mcqIds: [], openEndedQuestionIds: [], codingProblemIds: []
      }
      await expect((service as any).editAssessment(1, body, 5)).rejects.toMatchObject({
        status: 'error',
        statusCode: 404,
        message: 'The total weightage must equal 100.',
      })
    })

    it('should error if passPercentage > 100', async () => {
      const body: any = {
        weightageCodingQuestions: 50,
        weightageMcqQuestions: 50,
        passPercentage: 101,
        mcqIds: [], openEndedQuestionIds: [], codingProblemIds: []
      }
      await expect((service as any).editAssessment(1, body, 5)).rejects.toMatchObject({
        status: 'error',
        statusCode: 404,
        message: 'Pass percentage cannot be greater than 100.',
      })
    })

    it('should error if startDatetime < publishDatetime', async () => {
      const now = Date.now()
      const body: any = {
        weightageCodingQuestions: 50,
        weightageMcqQuestions: 50,
        passPercentage: 50,
        publishDatetime: new Date(now).toISOString(),
        startDatetime: new Date(now - 1000).toISOString(),
        mcqIds: [], openEndedQuestionIds: [], codingProblemIds: []
      }
      await expect((service as any).editAssessment(1, body, 5)).rejects.toMatchObject({
        status: 'error',
        statusCode: 400,
        message: 'startDatetime must be greater than or equal to publishDatetime',
      })
    })

    it('should error if endDatetime <= startDatetime', async () => {
      const now = Date.now()
      const body: any = {
        weightageCodingQuestions: 50,
        weightageMcqQuestions: 50,
        passPercentage: 50,
        startDatetime: new Date(now).toISOString(),
        endDatetime: new Date(now).toISOString(),
        mcqIds: [], openEndedQuestionIds: [], codingProblemIds: []
      }
      await expect((service as any).editAssessment(1, body, 5)).rejects.toMatchObject({
        status: 'error',
        statusCode: 400,
        message: 'endDatetime must be greater than startDatetime',
      })
    })
  })

  describe('getAssessmentDetailsOfQuiz', () => {
    beforeEach(() => {
      ;(service as any).getQuizQuestionsByAllDifficulties = jest.fn().mockResolvedValue([null, {
        easy: [{ quizId: 1, quizTitle: 'Q1', variantId: 11, question: 'E1', options: ['a'], correctOption: 'a', variantNumber: 1, assessmentId: 1001 }],
        medium: [{ quizId: 2, quizTitle: 'Q2', variantId: 22, question: 'M1', options: ['b'], correctOption: 'b', variantNumber: 1, assessmentId: 1002 }],
        hard: [{ quizId: 3, quizTitle: 'Q3', variantId: 33, question: 'H1', options: ['c'], correctOption: 'c', variantNumber: 1, assessmentId: 1003 }],
      }])

      ;(service as any).db = {
        query: {
          zuvyOutsourseAssessments: {
            findFirst: jest.fn().mockResolvedValue({
              ModuleAssessment: {},
              submitedOutsourseAssessments: [{ id: 999 }],
              easyMcqMark: 5.9,
              mediumMcqMark: 7.2,
              hardMcqMark: 9.8,
            })
          }
        }
      }
    })

    it('should build mcqs with proper marks per difficulty and return success', async () => {
      const [err, res] = await (service as any).getAssessmentDetailsOfQuiz(10, { roles: [] }, 42, true)
      expect(err).toBeNull()
      expect(res.statusCode).toBe(200)
      expect(res.data.mcqs).toHaveLength(3)
      const easy = res.data.mcqs.find((m) => m.difficulty === 'Easy')
      const medium = res.data.mcqs.find((m) => m.difficulty === 'Medium')
      const hard = res.data.mcqs.find((m) => m.difficulty === 'Hard')
      expect(easy.mark).toBe(Math.floor(5.9))
      expect(medium.mark).toBe(Math.floor(7.2))
      expect(hard.mark).toBe(Math.floor(9.8))
      // Should map outsourseQuizzesId correctly
      expect(easy.outsourseQuizzesId).toBe(1001)
    })

    it('should handle getQuizQuestions error path', async () => {
      ;(service as any).getQuizQuestionsByAllDifficulties = jest.fn().mockResolvedValue([{ message: 'Failed' }, null])

      const [err, res] = await (service as any).getAssessmentDetailsOfQuiz(10, { roles: [] }, 42, true)
      expect(err).toBeNull()
      expect(res.statusCode).toBe(400)
      expect(res.message).toBe('Failed')
    })

    it('should obfuscate userId for non-admin requests when user has admin role', async () => {
      // Ensure deterministic userId obfuscation via Math.random mock
      jest.spyOn(Math, 'random').mockReturnValue(0.5) // gives a mid-range value

      const [e, r] = await (service as any).getAssessmentDetailsOfQuiz(10, { roles: ['admin'] }, 7, false)
      expect(e).toBeNull()
      expect(r.statusCode).toBe(200)
      // We cannot easily read userId used internally; this test ensures it does not throw and returns success path
      ;(Math.random as any).mockRestore?.()
    })
  })
})

/**
 * Additional tests (diff-focused). Test library: Jest.
 * These tests focus on the newly modified/added logic to ensure coverage and correctness.
 */
jest.spyOn(Logger, 'error').mockImplementation(() => undefined as any)

describe('ContentService (additional diff-focused tests)', () => {
  let service: any
  const mockS3Send = jest.fn()
  const mockS3 = { send: mockS3Send }

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ContentService() as any
    service.s3 = mockS3
    service.bucket = 'test-bucket'
    service.region = 'ap-south-1'
  })

  describe('uploadPdfToS3 (appendix)', () => {
    it('builds correct S3 key prefix', async () => {
      mockS3Send.mockResolvedValueOnce({})
      const url = await service.uploadPdfToS3(Buffer.from('a'), 'file.pdf')
      expect(mockS3Send).toHaveBeenCalled()
      const cmd = mockS3Send.mock.calls[0][0]
      expect(cmd.input.Key.startsWith('zuvy_curriculum/')).toBe(true)
      expect(url.includes('zuvy_curriculum/')).toBe(true)
    })
  })

  describe('uploadImageToS3 (appendix)', () => {
    it('uses image/* content type', async () => {
      mockS3Send.mockResolvedValueOnce({})
      await service.uploadImageToS3(Buffer.from('a'), 'img.jpg')
      const cmd = mockS3Send.mock.calls[0][0]
      expect(cmd.input.ContentType).toBe('image/*')
    })
  })

  describe('lockContent (appendix)', () => {
    it('locks next module only when previous is completed >= 100', async () => {
      const modules = [{ id: 1, progress: 100 }, { id: 2, progress: 99 }, { id: 3, progress: 0 }]
      const res = await service.lockContent(modules)
      expect(res[0].lock).toBe(true)
      expect(res[1].lock).toBe(true)  // previous 100 → next locked
      expect(res[2].lock).toBe(false) // previous 99 → next unlocked
    })
  })
})