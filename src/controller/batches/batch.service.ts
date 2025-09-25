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
      console.log('Creating batch with data:', batch);

      // Basic validation
      if (!batch.name) {
        return [{ status: helperVariable.error, message: 'Batch name is required', code: 400 }, null];
      }
      if (!batch.bootcampId) {
        return [{ status: helperVariable.error, message: 'Bootcamp ID is required', code: 400 }, null];
      }
      if (!batch.instructorEmail) {
        return [{ status: helperVariable.error, message: 'Instructor email is required', code: 400 }, null];
      }
      if (!batch.capEnrollment || batch.capEnrollment <= 0) {
        return [{ status: helperVariable.error, message: 'capEnrollment must be a positive integer', code: 400 }, null];
      }

      // If assignAll, fetch available enrollments (unassigned students) limited to capEnrollment
      let usersData;
      if (batch.assignAll) {
        usersData = await db
          .select()
          .from(zuvyBatchEnrollments)
          .where(sql`${zuvyBatchEnrollments.bootcampId} = ${batch.bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NULL`)
          .orderBy(zuvyBatchEnrollments.id)
          .limit(batch.capEnrollment);
      }

      // Ensure instructor user exists (create if missing)
      let user = await db.select().from(users).where(eq(users.email, batch.instructorEmail));
      if (!user || user.length === 0) {
        user = await db
          .insert(users)
          .values({ email: batch.instructorEmail, name: batch.instructorEmail.split('@')[0] })
          .returning();
      }
      if (!user || user.length === 0) {
        return [{ status: helperVariable.error, message: 'Failed to create/find instructor user', code: 500 }, null];
      }

      // Try to ensure instructor role exists but do not block on failure
      try {
        const instructorRoles = await db.select({ role: sansaarUserRoles.role }).from(sansaarUserRoles).where(eq(sansaarUserRoles.userId, Number(user[0].id)));
        const hasInstructorRole = instructorRoles.some((r) => r.role === helperVariable.instructor);
        if (!hasInstructorRole) {
          try {
            await db.insert(sansaarUserRoles).values({ userId: Number(user[0].id), role: helperVariable.instructor, createdAt: new Date().toISOString() }).returning();
          } catch (err) {
            console.log('Failed to assign instructor role:', err?.message || err);
          }
        }
      } catch (err) {
        console.log('Error checking instructor role:', err?.message || err);
      }

      // Build batch object
      const batchValue: any = {
        name: batch.name,
        bootcampId: batch.bootcampId,
        instructorId: Number(user[0].id),
        capEnrollment: batch.capEnrollment,
      };
      if (batch.startDate) batchValue.startDate = new Date(batch.startDate);
      if (batch.endDate) batchValue.endDate = new Date(batch.endDate);
      if (batch.status) batchValue.status = batch.status;

      // If not assignAll: validate provided studentIds and enroll them
      if (!batch.assignAll) {
        if (!batch.studentIds || !Array.isArray(batch.studentIds) || batch.studentIds.length === 0) {
          return [{ status: helperVariable.error, message: 'studentIds is required when assignAll is false', code: 400 }, null];
        }

        const userIds = batch.studentIds.map((u) => BigInt(u));

        // Validate student count
        if (userIds.length > batch.capEnrollment) {
          return [{ status: helperVariable.error, message: `Invalid number of students. Must be between 1 and ${batch.capEnrollment}.`, code: 400 }, null];
        }

        // Ensure provided students have enrollments for this bootcamp
        const enrollments = await db
          .select()
          .from(zuvyBatchEnrollments)
          .where(sql`${zuvyBatchEnrollments.bootcampId} = ${batch.bootcampId} AND ${inArray(zuvyBatchEnrollments.userId, userIds)}`)
          .orderBy(zuvyBatchEnrollments.id);

        if (!enrollments || enrollments.length !== userIds.length) {
          return [{ status: helperVariable.error, message: 'One or more studentIds are invalid or not enrolled in this bootcamp', code: 400 }, null];
        }

        // Create batch
        const newData = await db.insert(zuvyBatches).values(batchValue).returning();

        // Assign specified students to the batch
        await db.update(zuvyBatchEnrollments).set({ batchId: newData[0].id }).where(sql`bootcamp_id = ${batch.bootcampId} AND ${inArray(zuvyBatchEnrollments.userId, userIds)}`);

        const createdBatch = newData[0];
        const createdBatchWithStatus = {
          ...createdBatch,
          instructorEmail: user[0]?.email || null,
          startDate: createdBatch.startDate ? new Date(String(createdBatch.startDate)).toISOString() : null,
          endDate: createdBatch.endDate ? new Date(String(createdBatch.endDate)).toISOString() : null,
          status: ((createdBatch as any).endDate && new Date(String((createdBatch as any).endDate)) < new Date()) ? 'Completed' : 'Ongoing',
        } as any;

        return [null, { status: helperVariable.success, message: 'Batch created successfully', code: 200, batch: createdBatchWithStatus }];
      }

      // assignAll flow
      if (usersData && usersData.length > 0) {
        const newData = await db.insert(zuvyBatches).values(batchValue).returning();
        const userIds = usersData.map((u) => u.userId);

        await db.update(zuvyBatchEnrollments).set({ batchId: newData[0].id }).where(sql`bootcamp_id = ${batch.bootcampId} AND ${inArray(zuvyBatchEnrollments.userId, userIds)}`);

        const createdBatch = newData[0];
        const createdBatchWithStatus = {
          ...createdBatch,
          instructorEmail: user[0]?.email || null,
          startDate: createdBatch.startDate ? new Date(String(createdBatch.startDate)).toISOString() : null,
          endDate: createdBatch.endDate ? new Date(String(createdBatch.endDate)).toISOString() : null,
          status: ((createdBatch as any).endDate && new Date(String((createdBatch as any).endDate)) < new Date()) ? 'Completed' : 'Ongoing',
        } as any;

        return [null, { status: helperVariable.success, message: 'Batch created successfully', code: 200, batch: createdBatchWithStatus }];
      }

      return [{ status: helperVariable.error, message: 'No students found to enroll in this Batch', code: 400 }, null];
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
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, BigInt(data[0].instructorId)))
        .limit(1);
      const instructorName = batchInstructor.length > 0 ? batchInstructor[0].name : null;
      const instructorEmail = batchInstructor.length > 0 ? batchInstructor[0].email : null;
      data[0]['instructorName'] = instructorName;
      data[0]['instructorEmail'] = instructorEmail;
      // Ensure start/end dates are present in returned batch object and normalized
      data[0]['startDate'] = data[0]['startDate'] ? new Date(String(data[0]['startDate'])).toISOString() : null;
      data[0]['endDate'] = data[0]['endDate'] ? new Date(String(data[0]['endDate'])).toISOString() : null;
      // data[0]['students'] = respObj;
      return [null, {
        status: 'success',
        message: 'Batch fetched successfully',
        code: 200,
        batch: {
          ...data[0]
        },
      }];
    } catch (e) {
      log(`error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async updateBatch(id: number, batch: PatchBatchDto) {
    try {
      console.log('Updating batch with data:', batch);

      // Fetch existing batch including enrolled students
      let batchOld: any = await db.query.zuvyBatches.findMany({
        where: sql`${zuvyBatches.id} = ${id}`,
        with: {
          students: true,
        },
      });

      if (!batchOld.length) {
        return [{ status: 'error', message: 'Batch not found', code: 404 }, null];
      }

      const currentStudentsCount = batchOld[0].students?.length || 0;

      // If capEnrollment is provided, ensure it's not less than currently enrolled students
      if (batch.capEnrollment !== undefined && currentStudentsCount > batch.capEnrollment) {
        return [
          { status: 'error', message: 'Students are enrolled in more than this capEnrollment.', code: 400 },
          null,
        ];
      }

      // Build update object only from provided fields
      const batchValue: any = {};
      if (batch.name !== undefined) batchValue.name = batch.name;
      if (batch.capEnrollment !== undefined) batchValue.capEnrollment = batch.capEnrollment;
      if (batch.status !== undefined) batchValue.status = batch.status;
      if (batch.startDate !== undefined) batchValue.startDate = batch.startDate ? new Date(batch.startDate) : null;
      if (batch.endDate !== undefined) batchValue.endDate = batch.endDate ? new Date(batch.endDate) : null;
      batchValue.updatedAt = new Date();

      // If instructorEmail provided, ensure user exists and has instructor role (try to assign if missing)
      let instructorEmailToReturn: string | null = null;
      if (batch.instructorEmail) {
        let userRes: any = await db.select().from(users).where(eq(users.email, batch.instructorEmail));
        if (userRes.length === 0) {
          userRes = await db.insert(users).values({ email: batch.instructorEmail, name: batch.instructorEmail.split('@')[0] }).returning();
        }

        if (!userRes || userRes.length === 0) {
          return [{ status: 'error', message: 'Failed to create or find instructor user', code: 500 }, null];
        }

        const userObj = userRes[0];
        instructorEmailToReturn = userObj.email;

        try {
          const instructorRoles = await db.select({ role: sansaarUserRoles.role }).from(sansaarUserRoles).where(eq(sansaarUserRoles.userId, Number(userObj.id)));
          const hasInstructorRole = instructorRoles.some((r) => r.role === helperVariable.instructor);
          if (!hasInstructorRole) {
            // attempt assigning role but do not block update if this fails
            try {
              await db.insert(sansaarUserRoles).values({ userId: Number(userObj.id), role: helperVariable.instructor, createdAt: new Date().toISOString() } as any).returning();
            } catch (roleErr) {
              console.log('Failed to assign instructor role:', roleErr?.message || roleErr);
            }
          }
        } catch (roleCheckErr) {
          console.log('Error checking/assigning instructor role:', roleCheckErr?.message || roleCheckErr);
        }

        batchValue.instructorId = Number(userObj.id);
      }

      // If instructorEmail wasn't provided, keep existing instructorId unchanged by not including it in batchValue

      // perform 
      console.log('Performing update with data:', batchValue);
      let updateData = await db.update(zuvyBatches).set(batchValue).where(eq(zuvyBatches.id, id)).returning();
      console.log('Update result:', updateData);
      if (!updateData || updateData.length === 0) {
        return [{ status: 'error', message: 'Batch not found', code: 404 }, null];
      }

      const updated = updateData[0];

      // Resolve instructorEmail for response
      let responseInstructorEmail = instructorEmailToReturn;
      if (!responseInstructorEmail && updated.instructorId) {
        try {
          const inst = await db.select({ email: users.email }).from(users).where(eq(users.id, BigInt(updated.instructorId))).limit(1);
          if (inst.length) responseInstructorEmail = inst[0].email;
        } catch (e) {
          // ignore and leave email null
        }
      }

      const updatedResp = {
        ...updated,
        instructorEmail: responseInstructorEmail || null,
        startDate: updated.startDate ? new Date(String(updated.startDate)).toISOString() : null,
        endDate: updated.endDate ? new Date(String(updated.endDate)).toISOString() : null,
        status: (updated.endDate && new Date(String(updated.endDate)) < new Date()) ? 'Completed' : 'Ongoing',
      } as any;

      return [null, { status: 'success', message: 'Batch updated successfully', code: 200, batch: updatedResp }];
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
        )
        .orderBy(users.id);

      return [null, { status: 'success', message: 'Students not enrolled in any batch', statusCode: 200, data: usersData }];
    } catch (err) {
      return [{ status: 'error', message: err.message, code: 400 }, null];
    }
  }

}