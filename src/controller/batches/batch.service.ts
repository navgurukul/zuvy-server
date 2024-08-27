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
import { PatchBatchDto,BatchDto } from './dto/batch.dto';
import { helperVariable } from 'src/constants/helper';

@Injectable()
export class BatchesService {
  async createBatch(batch:BatchDto) {
    try {
      const usersData = await db
      .select()
        .from(zuvyBatchEnrollments)
        .where(
          sql`${zuvyBatchEnrollments.bootcampId} = ${batch.bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NULL`,
        )
        .limit(batch.capEnrollment);
        var batchValue;
        var user = await db.select().from(users).where(eq(users.email,batch.instructorEmail));
        if(user.length == 0)
          {
            user = await db.insert(users).values({email:batch.instructorEmail,name : batch.instructorEmail.split("@")[0]}).returning();
          }
        if(user.length>0)
          {
             const instructorRoles = await db.select({role:sansaarUserRoles.role}).from(sansaarUserRoles).where(eq(sansaarUserRoles.userId,Number(user[0].id))) 
             const hasInstructorRole = instructorRoles.some(role => role.role === helperVariable.instructor);
             if(!hasInstructorRole)
              {
                const newlyAssignedInstructor = await db
                 .insert(sansaarUserRoles)
                   .values({ userId : Number(user[0].id),role: helperVariable.instructor,createdAt:new Date().toISOString()}).returning();
                if(newlyAssignedInstructor.length > 0)
                  {
                    batchValue = {
                      name:batch.name,
                      bootcampId: batch.bootcampId,
                      instructorId: Number(user[0].id),
                      capEnrollment: batch.capEnrollment
                    }
                  }
              }
              else {
                batchValue = {
                  name:batch.name,
                  bootcampId: batch.bootcampId,
                  instructorId: Number(user[0].id),
                  capEnrollment: batch.capEnrollment
                }
              }
          }
      if (usersData.length > 0) {
        const newData = await db.insert(zuvyBatches).values(batchValue).returning();
        let userids = usersData.map((u) => u.userId);
        
        await db
        .update(zuvyBatchEnrollments)
          .set({ batchId: newData[0].id })
          .where(
            sql`bootcamp_id = ${batch.bootcampId} AND user_id IN ${userids}`,
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
      let batchOld:any = await db.query.zuvyBatches.findMany({ 
        where: sql`${zuvyBatches.id} = ${id}`,
        with : {
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
      var user = await db.select().from(users).where(eq(users.email,batch.instructorEmail));
      if(user.length == 0)
        {
          user = await db.insert(users).values({email:batch.instructorEmail,name : batch.instructorEmail.split("@")[0]}).returning();
        }
      if(user.length>0)
        {
           const instructorRoles = await db.select({role:sansaarUserRoles.role}).from(sansaarUserRoles).where(eq(sansaarUserRoles.userId,Number(user[0].id))) 
           const hasInstructorRole = instructorRoles.some(role => role.role === 'instructor');
           if(!hasInstructorRole)
            {
              const newlyAssignedInstructor = await db
               .insert(sansaarUserRoles)
                 .values({ userId : Number(user[0].id),role: 'instructor',createdAt:new Date().toISOString()}).returning();
              if(newlyAssignedInstructor.length > 0)
                {
                  batchValue = {
                    name:batch.name,
                    instructorId: Number(user[0].id),
                    capEnrollment: batch.capEnrollment
                  }
                }
            }
            else {
              batchValue = {
                name:batch.name,
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
      let querySQL ;
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
}
