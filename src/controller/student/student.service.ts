import { Injectable, Logger } from '@nestjs/common';
import { error, log } from 'console';
import {
  zuvyBatchEnrollments,
  zuvyBootcampTracking,
  zuvyBootcamps,
  zuvyBootcampType,
  zuvySessions,
  users
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql, desc, count,asc } from 'drizzle-orm';
import { ClassesService } from '../classes/classes.service'
import { query } from 'express';
import { helperVariable } from 'src/constants/helper';
import { STATUS_CODES } from 'http';
import {ErrorResponse} from 'src/errorHandler/handler';

@Injectable()
export class StudentService {
  constructor(private ClassesService: ClassesService) { }
  async enrollData(userId: number) {
    try {
      let enrolled = await db.query.zuvyBatchEnrollments.findMany({
        where: (zuvyBatchEnrollments, { sql }) => sql`${zuvyBatchEnrollments.userId} = ${userId}`,
        columns: {
          id: true
        },
        with: {
          bootcamp: {
            columns: {
              id: true,
              name: true,
              coverImage: true,
              duration: true,
              language: true,
              bootcampTopic: true
            },
          },
          batchInfo: true,
          tracking: {
            where: (bootcampTracking, { sql }) =>
              sql`${bootcampTracking.userId} = ${userId}`,
          }
        }
      })
      let totalData = enrolled.map((e: any) => {
        const { batchInfo, tracking, bootcamp } = e;

        return {
          ...bootcamp,
          batchId: batchInfo?.id,
          batchName: batchInfo?.name,
          progress: tracking?.progress || 0
        };
      });



      return [null, totalData];
    } catch (err) {
      error(`error: ${err.message}`);
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }

  async enrollmentData(bootcampId: number) {
    try {
      let enrolled = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId}`);
      let unEnrolledBatch = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(
          sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NULL`,
        );
      return [
        null,
        {
          students_in_bootcamp: enrolled.length,
          unassigned_students: unEnrolledBatch.length,
        },
      ];
    } catch (error) {
      log(`error: ${error.message}`);
      return [{ status: 'error', message: error.message, code: 500 }, null];
    }
  }

  async searchPublicBootcampByStudent(searchTerm: string) {
    try {
      let getPubliczuvyBootcamps = await db
        .select()
        .from(zuvyBootcamps)
        .innerJoin(zuvyBootcampType, eq(zuvyBootcamps.id, zuvyBootcampType.bootcampId))
        .where(
          sql`${zuvyBootcampType.type} = 'Public' AND (LOWER(${zuvyBootcamps.name
            }) LIKE ${searchTerm.toLowerCase()} || '%')`,
        );
      let data = await Promise.all(
        getPubliczuvyBootcamps.map(async (bootcamp) => {
          let [err, res] = await this.enrollmentData(bootcamp.zuvy_bootcamp_type.bootcampId);
          if (err) {
            return [err, null];
          }
          return { ...bootcamp, ...res };
        }),
      );
      return [null, data];
    } catch (err) {
      error(`error: ${err.message}`);
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }

  async getPublicBootcamp() {
    try {
      let getPubliczuvyBootcamps = await db
        .select()
        .from(zuvyBootcamps)
        .innerJoin(zuvyBootcampType, eq(zuvyBootcamps.id, zuvyBootcampType.bootcampId))
        .where(
          sql`${zuvyBootcampType.type} = 'Public'`,
        );
      let data = await Promise.all(
        getPubliczuvyBootcamps.map(async (bootcamp) => {
          let [err, res] = await this.enrollmentData(bootcamp.zuvy_bootcamp_type.bootcampId);
          if (err) {
            return [err, null];
          }
          return { ...bootcamp, ...res };
        }),
      );
      return [null, data];
    } catch (err) {
      error(`error: ${err.message}`);
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }

  async removingStudent(user_id: number, bootcamp_id) {
    try {
      let enrolled = await db
        .delete(zuvyBatchEnrollments)
        .where(
          sql`${zuvyBatchEnrollments.userId} = ${user_id} AND ${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} `,
        )
        .returning();
      if (enrolled.length == 0) {
        return [{ status: 'error', message: 'id not found', code: 404 }, null];
      }
      return [
        null,
        {
          status: 'true',
          message: 'Student removed for the bootcamp',
          code: 200,
        },
      ];
    } catch (e) {
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async getUpcomingClass(student_id: number, batchID: number,limit:number,offset:number):Promise<any> {
    try {
      let queryString
      if (batchID) {
        queryString = sql`${zuvyBatchEnrollments.userId} = ${student_id} AND ${zuvyBatchEnrollments.batchId} = ${batchID}`
      } else {
        queryString = sql`${zuvyBatchEnrollments.userId} = ${student_id}`
      }
      let enrolled = await db.select().from(zuvyBatchEnrollments).where(queryString);

      if (enrolled.length == 0) {
        return [null,{message:'not enrolled in any course.',statusCode: STATUS_CODES.OK,data:[]}]
      }
      let bootcampAndbatchIds = await Promise.all(
        enrolled
          .filter(e => e.batchId !== null) 
          .map(async e => {
            await this.ClassesService.updatingStatusOfClass(e.bootcampId, e.batchId);
            return {bootcampId:e.bootcampId,batchId: e.batchId};
          })
      );
      let upcomingClasses = await db.query.zuvySessions.findMany({
        where: (session, { or, and, eq ,ne}) =>
          and(
            or(...bootcampAndbatchIds.map(({ bootcampId, batchId }) => 
              and(
                eq(session.bootcampId, bootcampId),
                eq(session.batchId, batchId)
              )
            )),
            ne(session.status, 'completed')

          ),
        orderBy: (session, { asc }) => asc(session.startTime),
        with : {
          bootcampDetail : {
            columns : {
              id:true,
              name:true
            }
          }
        },
        extras: {
          totalCount: sql<number>`coalesce(count(*) over(), 0)`.as('total_count')
        },
        limit,
        offset
       })
      const totalCount = upcomingClasses.length > 0 ? upcomingClasses[0]['totalCount'] : 0;
        
       const totalClasses =totalCount;
      let filterClasses = upcomingClasses.reduce((acc, e) => {
          e['bootcampName'] = e['bootcampDetail'].name;
          e['bootcampId'] = e['bootcampDetail'].id;
          delete  e['bootcampDetail'];
          delete e['totalCount']
        if (e.status == helperVariable.upcoming) {
          acc.upcoming.push(e);
        } else {
          acc.ongoing.push(e);
        }
        return acc;
      }, {upcoming: [], ongoing: [] });
      if(Number(totalClasses) == 0)
        {
        return [null,{message:'No upcoming classes',statusCode: STATUS_CODES.OK,data:[]}]
          
        }
      return [null,{message:'Upcoming classes fetched successfully',statusCode: STATUS_CODES.OK,data:{filterClasses,totalClasses:Number(totalClasses),totalPages : !isNaN(limit) ? Math.ceil(totalClasses/limit) : 1}}]
    } catch (error) {
      return [{message:error.message,statusCode: STATUS_CODES.BAD_REQUEST}]
    }
  }

  async getAttendanceClass(student_id: number) {
    try {
      let enrolled = await db.query.zuvyBatchEnrollments.findMany({
        where: (zuvyBatchEnrollments, { sql }) => sql`${zuvyBatchEnrollments.userId} = ${student_id}`,
        with: {
          bootcamp: {
            id: true,
            name: true
          }
        }
      });

      if (enrolled.length == 0) {
        return [{ status: 'error', message: 'not enrolled in any course.', code: 404 }, null];
      }

      let totalAttendance = await Promise.all(enrolled.map(async (e: any) => {
        let classes = await db.select().from(zuvySessions).where(sql`${zuvySessions.batchId} = ${e.batchId} AND ${zuvySessions.status} = 'completed'`).orderBy(desc(zuvySessions.startTime));
        e.attendance = (e.attendance / classes.length) * 100 || 0;
        e.totalClasses = classes.length;
        e.attendedClasses = e.attendance;
        delete e.userId;
        delete e.bootcamp
        return e;
      }));
      return totalAttendance;
    } catch (err) {
      throw err;
    }

  }

  
  //This function returns the rank of a particular course based on avg of attendance and course progress
  //The query has a hierarchy from:-
  //zuvyBootcamp->zuvyBatchEnrollments(It has all the students of that particular bootcamp along with attendance)
  //ZuvyBatchEnrollments has a relation with userInfo and bootcamp Tracking table(contains course Progress)
  async getLeaderBoardDetailByBootcamp(bootcampId:number,limit:number,offset:number)
  {
    try {
      const data = await db.query.zuvyBootcamps.findMany({
        where: (bootcamp, { eq }) => eq(bootcamp.id, bootcampId),
        with: {
          students: {
            columns: { attendance: true },
            with: {
              userInfo: {
                columns: { id:true, name: true ,email:true},
              },
              userTracking: {
                columns: { progress: true, updatedAt: true },
                where: (track, { eq }) => eq(track.bootcampId, bootcampId)
              },
            }
          },
        },
      });
      const processedData = data.map(bootcamp => {
        const studentsWithAvg = bootcamp['students'].map(student => {
          if (student['userTracking'] == null) {
            student['userTracking'] = {};
        }
          student['userTracking']['progress'] = student['userTracking']['progress'] != null ? student['userTracking']['progress'] : 0;
          const progress =student['userTracking']['progress'];
          student['userTracking']['updatedAt'] = student['userTracking']['updatedAt'] != null ? student['userTracking']['updatedAt'] : new Date().toISOString();
          const attendance = student['attendance'] != null ?student['attendance']: 0;
          const averageScore = (attendance + progress) / 2;
          student['attendance'] = attendance;
          return {
            ...student,
            userInfo: {
              id:Number(student.userInfo.id),
              name:student.userInfo.name,
              email:student.userInfo.email,
              averageScore,
            },
          };
        }).sort((a, b) => {
          if (b.userInfo.averageScore === a.userInfo.averageScore) {
            return new Date(a.userTracking['updatedAt']).getTime() - new Date(b.userTracking.updatedAt).getTime();
          }
          return b.userInfo.averageScore - a.userInfo.averageScore;
        });
        const totalStudents = studentsWithAvg.length;
        const totalPages =!isNaN(limit) ? Math.ceil(totalStudents / limit) : 1;
        return {
          ...bootcamp,
          students: !isNaN(limit) && !isNaN(offset) ? studentsWithAvg.slice(offset, limit+offset) : studentsWithAvg,
          totalStudents,
          totalPages
        };
      });
      return processedData;
    }
    catch(err)
    {
         throw err;
    }
  }
}