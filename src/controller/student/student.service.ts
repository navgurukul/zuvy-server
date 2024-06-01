import { Injectable, Logger } from '@nestjs/common';
import { error, log } from 'console';
import {
  zuvyBatchEnrollments,
  zuvyBootcampTracking,
  zuvyBootcamps,
  zuvyBootcampType,
  zuvySessions
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql,desc, count } from 'drizzle-orm';
import { ClassesService } from '../classes/classes.service'

@Injectable()
export class StudentService {
  constructor(private ClassesService: ClassesService) { }
  async enrollData(userId: number) {
    try {
      let enrolled = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(
          sql`${zuvyBatchEnrollments.userId} = ${userId} AND ${zuvyBatchEnrollments.batchId} IS NOT NULL`,
        );

      let promises = enrolled.map(async (e) => {
        let bootcamp = await db
          .select()
          .from(zuvyBootcamps)
          .where(eq(zuvyBootcamps.id, e.bootcampId));
        let progress = await db
          .select()
          .from(zuvyBootcampTracking)
          .where(
            sql`${zuvyBootcampTracking.userId} = ${userId} AND ${zuvyBootcampTracking.bootcampId} = ${e.bootcampId}`,
          );
        bootcamp[0]['progress'] = progress[0] ? progress[0].progress : 0;
        return bootcamp[0];
      });

      let totalData = await Promise.all(promises);

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

  async getUpcomingClass(student_id:number) {
    try {
      
      let enrolled = await db.select().from(zuvyBatchEnrollments).where(sql`${zuvyBatchEnrollments.userId} = ${student_id}`);

      if (enrolled.length == 0) {
        return [{ status: 'error', message: 'not enrolled in any course.', code: 404 }, null];
      }
      
      let bootcampIds = await Promise.all(enrolled.map(async (e) => {
        await this.ClassesService.updatingStatusOfClass(e.bootcampId)
        return e.bootcampId;
      }));

      let upcomingClasses = await db
        .select()
        .from(zuvySessions)
        .where(
          sql`${zuvySessions.bootcampId} IN ${bootcampIds} AND ${zuvySessions.status} != 'completed'`,
        )
        .orderBy(desc(zuvySessions.startTime))

      let filterClasses = upcomingClasses.reduce((acc, e) => {
        if (e.status == 'upcoming') {
          acc.upcoming.push(e);
        } else {
          acc.ongoing.push(e);
        }
        return acc;
      }, {upcoming: [], ongoing: []});

      return filterClasses;
    } catch (err) {
      throw err;
    }
  }

    async getAttendanceClass(student_id:number) {
      try{
        let enrolled = await db.query.zuvyBatchEnrollments.findMany({
          where: (zuvyBatchEnrollments, { sql }) => sql`${zuvyBatchEnrollments.userId} = ${student_id}`,
          with:{
            bootcamp:{
              id:true,
              name:true
            }
          }
        });
        
        if (enrolled.length == 0) {
          return [{ status: 'error', message: 'not enrolled in any course.', code: 404 }, null];
        }
        
        let totalAttendance = await Promise.all(enrolled.map(async (e:any) => {
          let classes = await db.select().from(zuvySessions).where(sql`${zuvySessions.batchId} = ${e.batchId} AND ${zuvySessions.status} = 'completed'`).orderBy(desc(zuvySessions.startTime));
          e.attendance = (e.attendance/classes.length)*100 || 0;
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
}