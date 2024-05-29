import { Injectable } from '@nestjs/common';
import {
  zuvyBatches,
  users,
  sansaarUserRoles,
  zuvyBatchEnrollments,
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql } from 'drizzle-orm';
import { log } from 'console';

@Injectable()
export class BatchesService {
  async createBatch(batch) {
    try {
      const newData = await db.insert(zuvyBatches).values(batch).returning();
      const usersData = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(
          sql`${zuvyBatchEnrollments.bootcampId} = ${zuvyBatchEnrollments.bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NULL`,
        )
        .limit(batch.capEnrollment);

      if (usersData.length > 0) {
        let userids = usersData.map((u) => u.userId);
        await db
          .update(zuvyBatchEnrollments)
          .set({ batchId: newData[0].id })
          .where(
            sql`bootcamp_id = ${batch.bootcampId} AND user_id IN ${userids}`,
          );
      }
      return [
        null,
        {
          status: 'success',
          message: 'Batch created successfully',
          code: 200,
          batch: newData[0],
        },
      ];
    } catch (e) {
      log(`error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async getBatchById(id: number) {
    try {
      let data = await db.select().from(zuvyBatches).where(eq(zuvyBatches.id, id));
      if (data.length === 0) {
        return [
          { status: 'error', message: 'Batch not found', code: 404 },
          null,
        ];
      }
      let respObj = [];
      // if (students){
      let enrollStudents = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.batchId, id));

      const batchInstructor = await db
        .select()
        .from(users)
        .where(eq(users.id, BigInt(data[0].instructorId)));
      const instructorName =
        batchInstructor.length > 0 ? batchInstructor[0].name : null;
      data[0]['instructorName'] = instructorName;
      // data[0]['students'] = respObj;
      return [
        null,
        {
          status: 'success',
          message: 'Batch fetched successfully',
          code: 200,
          batch: data[0],
        },
      ];
      // }
      // return [null, {status: 'success', message: 'Batch fetched successfully', code: 200, batch: data[0]}];
    } catch (e) {
      log(`error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async updateBatch(id: number, batch: object) {
    try {
      let batchData = await db.select().from(zuvyBatches).where(eq(zuvyBatches.id, id));
      if (batchData.length === 0) {
        return [
          { status: 'error', message: 'Batch not found', code: 404 },
          null,
        ];
      }
      batch['updatedAt'] = new Date();
      let updateData = await db
        .update(zuvyBatches)
        .set(batch)
        .where(eq(zuvyBatches.id, id))
        .returning();
      if (updateData.length === 0) {
        return [
          { status: 'error', message: 'Batch not found', code: 404 },
          null,
        ];
      }
      return [
        null,
        {
          status: 'success',
          message: 'Batch updated successfully',
          code: 200,
          batch: updateData[0],
        },
      ];
    } catch (e) {
      log(`error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async deleteBatch(id: number) {
    try {
      let data = await db.delete(zuvyBatches).where(eq(zuvyBatches.id, id)).returning();
      await db
        .update(zuvyBatchEnrollments)
        .set({ batchId: null })
        .where(eq(zuvyBatchEnrollments.batchId, id))
        .returning();
      if (data.length === 0) {
        return [
          { status: 'error', message: 'Batch not found', code: 404 },
          null,
        ];
      }
      return [
        null,
        { status: 'success', message: 'Batch deleted successfully', code: 200 },
      ];
    } catch (e) {
      log(`error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async reassignBatch(studentID, newBatchID: number, oldBatchID: any, bootcampID: any) {
    try {
      let querySQL ;
      if (isNaN(oldBatchID)) {
        if (isNaN(bootcampID)) {
          return [{ status: 'error', message: 'Either Bootcamp ID or old batch ID is required.', code: 400 }, null];
        }
        querySQL = sql`${zuvyBatchEnrollments.userId} = ${BigInt(studentID)} AND ${zuvyBatchEnrollments.bootcampId} = ${bootcampID}`;
      } else {
        querySQL = sql`${zuvyBatchEnrollments.userId} = ${BigInt(studentID)} AND ${zuvyBatchEnrollments.batchId} = ${oldBatchID}`;
      }

      const res = await db
        .update(zuvyBatchEnrollments)
        .set({ batchId: newBatchID })
        .where(querySQL)
        .returning();

    if (res.length){
        return [
            null,
            {
                status: 'success',
                message: 'Batch reassign successfully',
                code: 200,
            },
        ];
    }
    return [{code: 401, status: 'error', message : 'error in reassigning batch'}];
    } catch (e) {
      log(`error: ${e}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }
}