import { Injectable } from '@nestjs/common';
import {
  zuvyBatches,
  users,
  sansaarUserRoles,
  zuvyBatchEnrollments,
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, ilike, inArray, or, sql, and } from 'drizzle-orm';
import { log } from 'console';
import { PatchBatchDto, BatchDto } from './dto/batch.dto';
import { helperVariable } from 'src/constants/helper';
import { STATUS_CODES } from 'http';

@Injectable()
export class BatchesService {
  async createBatch(batch: BatchDto) {
    try {
      let usersData;
      if (batch.assignAll) {
        usersData = await db
          .select()
          .from(zuvyBatchEnrollments)
          .where(
            sql`${zuvyBatchEnrollments.bootcampId} = ${batch.bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NULL`,
          ).orderBy(zuvyBatchEnrollments.id)
          .limit(batch.capEnrollment);
      }
      var batchValue;
      var user = await db.select().from(users).where(eq(users.email, batch.instructorEmail));
      if (user.length == 0) {
        user = await db.insert(users).values({ email: batch.instructorEmail, name: batch.instructorEmail.split("@")[0] }).returning();
      }
      if (user.length > 0) {
        const instructorRoles = await db.select({ role: sansaarUserRoles.role }).from(sansaarUserRoles).where(eq(sansaarUserRoles.userId, Number(user[0].id)))
        const hasInstructorRole = instructorRoles.some(role => role.role === helperVariable.instructor);
        if (!hasInstructorRole) {
          let insertRole: any = { userId: Number(user[0].id), role: helperVariable.instructor, createdAt: new Date().toISOString() }
          const newlyAssignedInstructor = await db
            .insert(sansaarUserRoles)
            .values(insertRole).returning();
          if (newlyAssignedInstructor.length > 0) {
            batchValue = {
              name: batch.name,
              bootcampId: batch.bootcampId,
              instructorId: Number(user[0].id),
              capEnrollment: batch.capEnrollment
            }
          }
        }
        else {
          batchValue = {
            name: batch.name,
            bootcampId: batch.bootcampId,
            instructorId: Number(user[0].id),
            capEnrollment: batch.capEnrollment
          }
        }
      }

      if (!batch.assignAll) {

        const userIds = batch.studentIds.map((u) => BigInt(u));
        // Validate student IDs and cap enrollment
        if (userIds.length > batch.capEnrollment) {
          return [
            {
              status: helperVariable.error,
              message: `Invalid number of students. Must be between 1 and ${batch.capEnrollment}.`,
              code: 400,
            },
            null,
          ];
        }

        // Create a new batch
        const newData = await db.insert(zuvyBatches).values(batchValue).returning();

        // Assign specified students to the batch
        await db
          .update(zuvyBatchEnrollments)
          .set({ batchId: newData[0].id })
          .where(
            sql`bootcamp_id = ${batch.bootcampId} AND ${inArray(zuvyBatchEnrollments.userId, userIds)}`,
          );

        return [
          null,
          {
            status: helperVariable.success,
            message: 'Batch created successfully',
            code: 200,
            batch: newData[0],
          },
        ];
      }

      // Handle assigning all unassigned students if assignAll is true
      if (usersData && usersData.length > 0) {
        const newData = await db.insert(zuvyBatches).values(batchValue).returning();
        const userIds = usersData.map((u) => u.userId);

        await db
          .update(zuvyBatchEnrollments)
          .set({ batchId: newData[0].id })
          .where(
            sql`bootcamp_id = ${batch.bootcampId} AND ${inArray(zuvyBatchEnrollments.userId, userIds)}`,
          );

        return [
          null,
          {
            status: helperVariable.success,
            message: 'Batch created successfully',
            code: 200,
            batch: newData[0],
          },
        ];
      } else {
        // return error if no user found
        return [
          { status: helperVariable.error, message: 'No students found to enroll in this Batch', code: 400 },
          null,
        ];
      }
    } catch (e) {
      log(`error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async getBatchById(id: number) {
    try {
      let data = await db
        .select()
        .from(zuvyBatches)
        .where(eq(zuvyBatches.id, id));
      if (data.length === 0) {
        return [
          { status: 'error', message: 'Batch not found', code: 404 },
          null,
        ];
      }
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
      const instructorEmail = batchInstructor.length > 0 ? batchInstructor[0].email : null;
      data[0]['instructorName'] = instructorName;
      data[0]['instructorEmail'] = instructorEmail;
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
    } catch (e) {
      log(`error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async updateBatch(id: number, batch: PatchBatchDto) {
    try {
      let batchOld: any = await db.query.zuvyBatches.findMany({
        where: sql`${zuvyBatches.id} = ${id}`,
        with: {
          students: true
        }
      });
      if (!batchOld.length) {
        return [{ status: 'error', message: 'Batch not found', code: 404 }, null];
      }
      if (batchOld[0].students.length > batch.capEnrollment) {
        return [{ status: 'error', message: 'Students are enrolled in more than this capEnrollment.', code: 400 }, null];
      }

      batch['updatedAt'] = new Date();
      var batchValue;
      var user = await db.select().from(users).where(eq(users.email, batch.instructorEmail));
      if (user.length == 0) {
        user = await db.insert(users).values({ email: batch.instructorEmail, name: batch.instructorEmail.split("@")[0] }).returning();
      }
      if (user.length > 0) {
        const instructorRoles = await db.select({ role: sansaarUserRoles.role }).from(sansaarUserRoles).where(eq(sansaarUserRoles.userId, Number(user[0].id)))
        const hasInstructorRole = instructorRoles.some(role => role.role === helperVariable.instructor);
        if (!hasInstructorRole) {
          let insertRole: any = { userId: Number(user[0].id), role: helperVariable.instructor, createdAt: new Date().toISOString() }
          const newlyAssignedInstructor = await db
            .insert(sansaarUserRoles)
            .values(insertRole).returning();
          if (newlyAssignedInstructor.length > 0) {
            batchValue = {
              name: batch.name,
              instructorId: Number(user[0].id),
              capEnrollment: batch.capEnrollment
            }
          }
        }
        else {
          batchValue = {
            name: batch.name,
            instructorId: Number(user[0].id),
            capEnrollment: batch.capEnrollment
          }
        }
      }
      let updateData = await db
        .update(zuvyBatches)
        .set(batchValue)
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
      await db
        .update(zuvyBatchEnrollments)
        .set({ batchId: null })
        .where(eq(zuvyBatchEnrollments.batchId, id))
        .returning();
      let data = await db.delete(zuvyBatches).where(eq(zuvyBatches.id, id)).returning();

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

  async reassignBatch(
    studentID,
    newBatchID: number,
    oldBatchID: any,
    bootcampID: any,
  ) {
    try {
      let querySQL;
      if (isNaN(oldBatchID)) {
        if (isNaN(bootcampID)) {
          return [
            {
              status: 'error',
              message: 'Either Bootcamp ID or old batch ID is required.',
              code: 400,
            },
            null,
          ];
        }
        querySQL = sql`${zuvyBatchEnrollments.userId} = ${BigInt(studentID)} AND ${zuvyBatchEnrollments.bootcampId} = ${bootcampID}`;
      } else {
        querySQL = sql`${zuvyBatchEnrollments.userId} = ${BigInt(studentID)} AND ${zuvyBatchEnrollments.batchId} = ${oldBatchID}`;
      }
      let batchAssigned: any = await db.query.zuvyBatches.findMany({
        where: sql`${zuvyBatches.id} = ${newBatchID}`,
        with: {
          students: true
        }
      });
      if (batchAssigned.length == 0) {
        return [{ status: 'error', message: 'No batch found', code: 404 }, null];
      }
      if (batchAssigned[0].students.length == batchAssigned[0].capEnrollment) {
        return [{ status: 'error', message: 'Batch is full', code: 400 }, null];
      }

      const res = await db
        .update(zuvyBatchEnrollments)
        .set({ batchId: newBatchID })
        .where(querySQL)
        .returning();

      if (res.length) {
        return [
          null,
          {
            status: 'success',
            message: 'Batch reassign successfully',
            code: 200,
          },
        ];
      }
      return [
        { code: 401, status: 'error', message: 'error in reassigning batch' },
      ];
    } catch (e) {
      log(`error: ${e}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async getNotEnrolledStudents(bootcampId: number, searchTerm: string): Promise<any> {
    try {
      const unenrolledUserIds = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(
          sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NULL`,
        ).orderBy(zuvyBatchEnrollments.id)

      const userIds = unenrolledUserIds.map((enrollment) => BigInt(enrollment.userId));

      if (userIds.length === 0) {
        return [null, []];
      }

      const usersData = await db
        .select({
          id: sql`CAST(${users.id} AS INTEGER)`.as('id'), 
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(
          and(
            inArray(sql`CAST(${users.id} AS INTEGER)`, userIds), 
            searchTerm
              ? or(
                ilike(users.name, `${searchTerm}%`),
                ilike(users.email, `${searchTerm}%`)
              )
              : undefined 
          )
        );

      return [null, { status: 'success', message: 'Students not enrolled in any batch', statusCode: 200, data: usersData }];
    } catch (err) {
      return [{ status: 'error', message: err.message, code: 400}, null];
    }
  }

}
