import { Injectable } from '@nestjs/common';
import {
  batches,
  bootcamps,
  users,
  sansaarUserRoles,
  batchEnrollments,
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql } from 'drizzle-orm';
import { log } from 'console';

@Injectable()
export class BatchesService {
  async createBatch(batch) {
    try {
      const newData = await db.insert(batches).values(batch).returning();
      const usersData = await db
        .select()
        .from(batchEnrollments)
        .where(
          sql`${batchEnrollments.bootcampId} = ${batch.bootcampId} AND ${batchEnrollments.batchId} IS NULL`,
        )
        .limit(batch.capEnrollment);

      if (usersData.length > 0) {
        let userids = usersData.map((u) => u.userId);
        await db
          .update(batchEnrollments)
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
      let data = await db.select().from(batches).where(eq(batches.id, id));
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
        .from(batchEnrollments)
        .where(eq(batchEnrollments.batchId, id));

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
      let batchData = await db.select().from(batches).where(eq(batches.id, id));
      if (batchData.length === 0) {
        return [
          { status: 'error', message: 'Batch not found', code: 404 },
          null,
        ];
      }
      // if (batch['capEnrollment']) {
      //     batchData[0].capEnrollment =batch['capEnrollment']
      //     // let [err,res] =  await this.capEnrollment(batchData[0], true);
      //     // if(err){
      //     //     return [err, null];
      //     // }
      // }
      batch['updatedAt'] = new Date();
      let updateData = await db
        .update(batches)
        .set(batch)
        .where(eq(batches.id, id))
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
      let data = await db.delete(batches).where(eq(batches.id, id)).returning();
      await db
        .update(batchEnrollments)
        .set({ batchId: null })
        .where(eq(batchEnrollments.batchId, id))
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

  async reassignBatch(studentID, newBatchID: number, oldBatchID: number) {
    try {
      const res = await db
        .update(batchEnrollments)
        .set({ batchId: newBatchID })
        .where(
          sql`${batchEnrollments.userId} = ${BigInt(studentID)} AND ${batchEnrollments.batchId} = ${oldBatchID}`,
        )
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
    return [{code: 200, status: 'success', message : 'Unassign to the new batch'}]
    } catch (e) {
      log(`error: ${e}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }
}
