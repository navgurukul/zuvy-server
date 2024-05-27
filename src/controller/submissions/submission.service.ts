import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, count, lte } from 'drizzle-orm';
// import { BatchesService } from '../batches/batch.service';
import axios from 'axios';
import * as _ from 'lodash';
import { error, log } from 'console';
import {
  zuvyBatchEnrollments,
  zuvyChapterTracking
} from '../../../drizzle/schema';

const { ZUVY_CONTENT_URL } = process.env;

@Injectable()
export class SubmissionService {
  async getSubmissionOfPractiseProblem(bootcampId: number) {
    try {
      const topicId = 3;
      const trackingData = await db.query.zuvyCourseModules.findMany({
        where: (courseModules, { eq }) =>
          eq(courseModules.bootcampId, bootcampId),
        orderBy: (courseModules, { asc }) => asc(courseModules.order),
        with: {
          moduleChapterData: {
            columns: {
              id: true,
            },
            where: (moduleChapter, { eq }) =>
              eq(moduleChapter.topicId, topicId),
            with: {
              chapterTrackingDetails: {
                columns: {
                  userId: true,
                },
              },
              codingQuestionDetails: {
                columns: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        }
      });

      const zuvyBatchEnrollmentsCount = await db
        .select({
          count: sql<number>`cast(count(${zuvyBatchEnrollments.id}) as int)`,
        })
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId));

      trackingData.forEach((course) => {
        course.moduleChapterData.forEach((chapterTracking) => {
          chapterTracking['submitStudents'] =
            chapterTracking['chapterTrackingDetails'].length;
          delete chapterTracking['chapterTrackingDetails'];
        });
      });

      return {
        trackingData,
        totalStudents: zuvyBatchEnrollmentsCount[0]?.count,
      };
    } catch (err) {
      throw err;
    }
  }

  async practiseProblemStatusOfStudents(
    questionId: number,
    chapterId: number,
    moduleId: number,
    limit: number,
    offset: number
  ) {
    try {
      const statusOfStudentCode = await db.query.zuvyChapterTracking.findMany({
        where: (chapterTracking, { sql }) =>
          sql`${chapterTracking.chapterId} = ${chapterId} AND ${chapterTracking.moduleId} = ${moduleId}`,
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
            with: {
              studentCodeDetails: true,
            },
          },
        },
        limit:limit,
        offset:offset
      });
      const totalStudents = await db.select().from(zuvyChapterTracking).where(sql`${zuvyChapterTracking.moduleId} = ${moduleId} and ${zuvyChapterTracking.chapterId} = ${chapterId}`);
      const totalStudentsCount = totalStudents.length;
      const totalPages = Math.ceil(totalStudentsCount/limit);
      const data = statusOfStudentCode.map((statusCode) => {
        return {
          id: Number(statusCode['user']['id']),
          name: statusCode['user']['name'],
          emailId: statusCode['user']['email'],
          noOfAttempts:
            statusCode['user']['studentCodeDetails']?.['questionSolved'][
              `${questionId}`
            ]?.['token'].length,
          status:
            statusCode['user']['studentCodeDetails']?.['questionSolved'][
              `${questionId}`
            ]?.['status'],
        };
      });

      return {data,totalPages,totalStudentsCount};
    } catch (err) {
      throw err;
    }
  }
}
