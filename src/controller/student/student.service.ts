import { Injectable, Logger } from '@nestjs/common';
import { error, log } from 'console';
import {
    batchEnrollments,
    batches,
    bootcampTracking,
    bootcamps,
    bootcampType
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql } from 'drizzle-orm';

@Injectable()
export class StudentService {
  async enrollData(userId: number) {
    try {
      let enrolled = await db
        .select()
        .from(batchEnrollments)
        .where(
          sql`${batchEnrollments.userId} = ${userId} AND ${batchEnrollments.batchId} IS NOT NULL`,
        );

      let promises = enrolled.map(async (e) => {
        let bootcamp = await db
          .select()
          .from(bootcamps)
          .where(eq(bootcamps.id, e.bootcampId));
        let progress = await db
          .select()
          .from(bootcampTracking)
          .where(
            sql`${bootcampTracking.userId} = ${userId} AND ${bootcampTracking.bootcampId} = ${e.bootcampId}`,
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
        .from(batchEnrollments)
        .where(sql`${batchEnrollments.bootcampId} = ${bootcampId}`);
      let unEnrolledBatch = await db
        .select()
        .from(batchEnrollments)
        .where(
          sql`${batchEnrollments.bootcampId} = ${bootcampId} AND ${batchEnrollments.batchId} IS NULL`,
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
      let getPublicBootcamps = await db
        .select()
        .from(bootcamps)
        .innerJoin(bootcampType, eq(bootcamps.id, bootcampType.bootcampId))
        .where(
          sql`${bootcampType.type} = 'Public' AND (LOWER(${
            bootcamps.name
          }) LIKE ${searchTerm.toLowerCase()} || '%')`,
        );
         let data = await Promise.all(
      getPublicBootcamps.map(async (bootcamp) => {
        let [err, res] = await this.enrollmentData(bootcamp.zuvy_bootcamps.id);
        if (err) {
          return [err, null];
        }
        return { ...bootcamp, ...res };
      }),
         );
         return [null,data];
    } catch (err) {
      error(`error: ${err.message}`);
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }

  async getPublicBootcamp() {
    try {
      let getPublicBootcamps = await db
        .select()
        .from(bootcamps)
        .innerJoin(bootcampType, eq(bootcamps.id, bootcampType.bootcampId))
        .where(
          sql`${bootcampType.type} = 'Public'`,
        );
         let data = await Promise.all(
      getPublicBootcamps.map(async (bootcamp) => {
        let [err, res] = await this.enrollmentData(bootcamp.zuvy_bootcamps.id);
        if (err) {
          return [err, null];
        }
        return { ...bootcamp, ...res };
      }),
         );
         return [null,data];
    } catch (err) {
      error(`error: ${err.message}`);
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }

  async removingStudent(user_id: number, bootcamp_id) {
    try {
      let enrolled = await db
        .delete(batchEnrollments)
        .where(
          sql`${batchEnrollments.userId} = ${user_id} AND ${batchEnrollments.bootcampId} = ${bootcamp_id} `,
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
}
