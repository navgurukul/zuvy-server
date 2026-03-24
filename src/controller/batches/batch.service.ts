import { Injectable } from '@nestjs/common';
import {
  users,
  zuvyBatches,
  zuvyUserRoles,
  zuvyUserRolesAssigned,
  zuvyBatchEnrollments,
  zuvyStudentAttendance,
  zuvyStudentAttendanceRecords,
  zuvySessions,
  zuvyBootcamps,
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, ilike, inArray, or, sql, and, not, isNull } from 'drizzle-orm';
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
        return [
          {
            status: helperVariable.error,
            message: 'Batch name is required',
            code: 400,
          },
          null,
        ];
      }
      if (!batch.bootcampId) {
        return [
          {
            status: helperVariable.error,
            message: 'Bootcamp ID is required',
            code: 400,
          },
          null,
        ];
      }
      if (!batch.instructorEmail) {
        return [
          {
            status: helperVariable.error,
            message: 'Instructor email is required',
            code: 400,
          },
          null,
        ];
      }
      if (!batch.capEnrollment || batch.capEnrollment <= 0) {
        return [
          {
            status: helperVariable.error,
            message: 'capEnrollment must be a positive integer',
            code: 400,
          },
          null,
        ];
      }

      // If assignAll, fetch available enrollments (unassigned students) limited to capEnrollment
      let usersData;
      if (batch.assignAll) {
        usersData = await db
          .select()
          .from(zuvyBatchEnrollments)
          .where(
            sql`${zuvyBatchEnrollments.bootcampId} = ${batch.bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NULL`,
          )
          .orderBy(zuvyBatchEnrollments.id)
          .limit(batch.capEnrollment);
      }

      // Ensure instructor user exists (create if missing)
      let user = await db
        .select()
        .from(users)
        .where(eq(users.email, batch.instructorEmail));
      if (!user || user.length === 0) {
        user = await db
          .insert(users)
          .values({
            email: batch.instructorEmail,
            name: batch.instructorEmail.split('@')[0],
          })
          .returning();
      }
      if (!user || user.length === 0) {
        return [
          {
            status: helperVariable.error,
            message: 'Failed to create/find instructor user',
            code: 500,
          },
          null,
        ];
      }

      // RBAC role assignment for the instructor
      try {
        const bootcamp = await db.query.zuvyBootcamps.findFirst({
          where: eq(zuvyBootcamps.id, batch.bootcampId),
        });
        const orgId = bootcamp?.organizationId;

        const instructorRole = await db
          .select({ id: zuvyUserRoles.id })
          .from(zuvyUserRoles)
          .where(
            and(
              eq(sql`lower(${zuvyUserRoles.name})`, 'instructor'),
              isNull(zuvyUserRoles.orgId),
            ),
          )
          .limit(1);

        const instructorRoleId = instructorRole[0]?.id;

        if (instructorRoleId && user[0]?.id) {
          const instructorUserId = BigInt(user[0].id);
          const existingAssignment =
            await db.query.zuvyUserRolesAssigned.findFirst({
              where: and(
                eq(zuvyUserRolesAssigned.userId, instructorUserId),
                eq(zuvyUserRolesAssigned.roleId, instructorRoleId),
                orgId
                  ? eq(zuvyUserRolesAssigned.organizationId, orgId)
                  : isNull(zuvyUserRolesAssigned.organizationId),
              ),
            });

          if (!existingAssignment) {
            let userData = {
              userId: instructorUserId,
              roleId: instructorRoleId,
              organizationId: orgId || null,
            };
            await db.insert(zuvyUserRolesAssigned).values(userData);
          }
        }
      } catch (err) {
        console.error('Failed to assign instructor role:', err);
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

      // Fetch bootcamp name for audit log
      const courseRes = await db
        .select({ name: zuvyBootcamps.name })
        .from(zuvyBootcamps)
        .where(eq(zuvyBootcamps.id, batch.bootcampId))
        .limit(1);
      const bootcampName = courseRes[0]?.name || '';

      // If not assignAll: validate provided studentIds and enroll them
      if (!batch.assignAll) {
        if (
          !batch.studentIds ||
          !Array.isArray(batch.studentIds) ||
          batch.studentIds.length === 0
        ) {
          return [
            {
              status: helperVariable.error,
              message: 'studentIds is required when assignAll is false',
              code: 400,
            },
            null,
          ];
        }

        const userIds = batch.studentIds.map((u) => BigInt(u));

        // Validate student count
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

        // Ensure provided students have enrollments for this bootcamp
        const enrollments = await db
          .select()
          .from(zuvyBatchEnrollments)
          .where(
            sql`${zuvyBatchEnrollments.bootcampId} = ${batch.bootcampId} AND ${inArray(zuvyBatchEnrollments.userId, userIds)}`,
          )
          .orderBy(zuvyBatchEnrollments.id);

        if (!enrollments || enrollments.length !== userIds.length) {
          return [
            {
              status: helperVariable.error,
              message:
                'One or more studentIds are invalid or not enrolled in this bootcamp',
              code: 400,
            },
            null,
          ];
        }

        // Create batch
        const newData = await db
          .insert(zuvyBatches)
          .values(batchValue)
          .returning();

        // Assign specified students to the batch
        await db
          .update(zuvyBatchEnrollments)
          .set({ batchId: newData[0].id })
          .where(
            sql`bootcamp_id = ${batch.bootcampId} AND ${inArray(zuvyBatchEnrollments.userId, userIds)}`,
          );

        const createdBatch = newData[0];
        const createdBatchWithStatus = {
          ...createdBatch,
          instructorEmail: user[0]?.email || null,
          startDate: createdBatch.startDate
            ? new Date(String(createdBatch.startDate)).toISOString()
            : null,
          endDate: createdBatch.endDate
            ? new Date(String(createdBatch.endDate)).toISOString()
            : null,
          status:
            (createdBatch as any).endDate &&
            new Date(String((createdBatch as any).endDate)) < new Date()
              ? 'Completed'
              : 'Ongoing',
        } as any;

        return [
          null,
          {
            status: helperVariable.success,
            message: 'Batch created successfully',
            code: 200,
            batch: createdBatchWithStatus,
            bootcampName,
          },
        ];
      }

      // assignAll flow
      if (usersData && usersData.length > 0) {
        const newData = await db
          .insert(zuvyBatches)
          .values(batchValue)
          .returning();
        const userIds = usersData.map((u) => u.userId);

        await db
          .update(zuvyBatchEnrollments)
          .set({ batchId: newData[0].id })
          .where(
            sql`bootcamp_id = ${batch.bootcampId} AND ${inArray(zuvyBatchEnrollments.userId, userIds)}`,
          );

        const createdBatch = newData[0];
        const createdBatchWithStatus = {
          ...createdBatch,
          instructorEmail: user[0]?.email || null,
          startDate: createdBatch.startDate
            ? new Date(String(createdBatch.startDate)).toISOString()
            : null,
          endDate: createdBatch.endDate
            ? new Date(String(createdBatch.endDate)).toISOString()
            : null,
          status:
            (createdBatch as any).endDate &&
            new Date(String((createdBatch as any).endDate)) < new Date()
              ? 'Completed'
              : 'Ongoing',
        } as any;

        return [
          null,
          {
            status: helperVariable.success,
            message: 'Batch created successfully',
            code: 200,
            batch: createdBatchWithStatus,
            bootcampName,
          },
        ];
      }

      return [
        {
          status: helperVariable.error,
          message: 'No students found to enroll in this Batch',
          code: 400,
        },
        null,
      ];
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

      const instructorId = data[0].instructorId;
      let instructorName = null;
      let instructorEmail = null;

      if (instructorId) {
        const batchInstructor = await db
          .select({ id: users.id, email: users.email, name: users.name })
          .from(users)
          .where(eq(users.id, BigInt(instructorId)))
          .limit(1);
        if (batchInstructor.length > 0) {
          instructorName = batchInstructor[0].name;
          instructorEmail = batchInstructor[0].email;
        }
      }
      data[0]['instructorName'] = instructorName;
      data[0]['instructorEmail'] = instructorEmail;
      // Ensure start/end dates are present in returned batch object and normalized
      data[0]['startDate'] = data[0]['startDate']
        ? new Date(String(data[0]['startDate'])).toISOString()
        : null;
      data[0]['endDate'] = data[0]['endDate']
        ? new Date(String(data[0]['endDate'])).toISOString()
        : null;
      // data[0]['students'] = respObj;
      return [
        null,
        {
          status: 'success',
          message: 'Batch fetched successfully',
          code: 200,
          batch: {
            ...data[0],
          },
        },
      ];
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
        return [
          { status: 'error', message: 'Batch not found', code: 404 },
          null,
        ];
      }

      const currentStudentsCount = batchOld[0].students?.length || 0;

      // If capEnrollment is provided, ensure it's not less than currently enrolled students
      if (
        batch.capEnrollment !== undefined &&
        currentStudentsCount > batch.capEnrollment
      ) {
        return [
          {
            status: 'error',
            message: 'Students are enrolled in more than this capEnrollment.',
            code: 400,
          },
          null,
        ];
      }

      // Build update object only from provided fields
      const batchValue: any = {};
      if (batch.name !== undefined) batchValue.name = batch.name;
      if (batch.capEnrollment !== undefined)
        batchValue.capEnrollment = batch.capEnrollment;
      if (batch.status !== undefined) batchValue.status = batch.status;
      if (batch.startDate !== undefined)
        batchValue.startDate = batch.startDate
          ? new Date(batch.startDate)
          : null;
      if (batch.endDate !== undefined)
        batchValue.endDate = batch.endDate ? new Date(batch.endDate) : null;
      batchValue.updatedAt = new Date();

      // If instructorEmail provided, ensure user exists and has instructor role (try to assign if missing)
      let instructorEmailToReturn: string | null = null;
      if (batch.instructorEmail) {
        let userRes: any = await db
          .select()
          .from(users)
          .where(eq(users.email, batch.instructorEmail));
        if (userRes.length === 0) {
          userRes = await db
            .insert(users)
            .values({
              email: batch.instructorEmail,
              name: batch.instructorEmail.split('@')[0],
            })
            .returning();
        }

        if (!userRes || userRes.length === 0) {
          return [
            {
              status: 'error',
              message: 'Failed to create or find instructor user',
              code: 500,
            },
            null,
          ];
        }

        const userObj = userRes[0];
        instructorEmailToReturn = userObj.email;

        // RBAC role assignment for the NEW instructor
        try {
          const bootcamp = await db.query.zuvyBootcamps.findFirst({
            where: eq(zuvyBootcamps.id, batchOld[0].bootcampId),
          });
          const orgId = bootcamp?.organizationId;

          const instructorRole = await db
            .select({ id: zuvyUserRoles.id })
            .from(zuvyUserRoles)
            .where(
              and(
                eq(sql`lower(${zuvyUserRoles.name})`, 'instructor'),
                isNull(zuvyUserRoles.orgId),
              ),
            )
            .limit(1);

          const instructorRoleId = instructorRole[0]?.id;

          if (instructorRoleId && userObj?.id) {
            const instructorUserId = BigInt(userObj.id);
            const existingAssignment =
              await db.query.zuvyUserRolesAssigned.findFirst({
                where: and(
                  eq(zuvyUserRolesAssigned.userId, instructorUserId),
                  eq(zuvyUserRolesAssigned.roleId, instructorRoleId),
                  orgId
                    ? eq(zuvyUserRolesAssigned.organizationId, orgId)
                    : isNull(zuvyUserRolesAssigned.organizationId),
                ),
              });

            if (!existingAssignment) {
              let userData = {
                userId: instructorUserId,
                roleId: instructorRoleId,
                organizationId: orgId || null,
              };
              await db.insert(zuvyUserRolesAssigned).values(userData);
            }
          }
        } catch (roleErr) {
          console.error('Failed to assign new instructor role:', roleErr);
        }

        if (userObj?.id) {
          batchValue.instructorId = Number(userObj.id);
        }
      }

      // If instructorEmail wasn't provided, keep existing instructorId unchanged by not including it in batchValue

      // perform
      console.log('Performing update with data:', batchValue);
      let updateData = await db
        .update(zuvyBatches)
        .set(batchValue)
        .where(eq(zuvyBatches.id, id))
        .returning();
      console.log('Update result:', updateData);
      if (!updateData || updateData.length === 0) {
        return [
          { status: 'error', message: 'Batch not found', code: 404 },
          null,
        ];
      }

      const updated = updateData[0];

      // Resolve instructorEmail for response
      let responseInstructorEmail = instructorEmailToReturn;
      if (!responseInstructorEmail && updated.instructorId) {
        try {
          const inst = await db
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, BigInt(updated.instructorId)))
            .limit(1);
          if (inst.length) responseInstructorEmail = inst[0].email;
        } catch (e) {
          // ignore and leave email null
        }
      }

      const updatedResp = {
        ...updated,
        instructorEmail: responseInstructorEmail || null,
        startDate: updated.startDate
          ? new Date(String(updated.startDate)).toISOString()
          : null,
        endDate: updated.endDate
          ? new Date(String(updated.endDate)).toISOString()
          : null,
        status:
          updated.endDate && new Date(String(updated.endDate)) < new Date()
            ? 'Completed'
            : 'Ongoing',
      } as any;

      const courseRes = await db
        .select({ name: zuvyBootcamps.name })
        .from(zuvyBootcamps)
        .where(eq(zuvyBootcamps.id, updated.bootcampId))
        .limit(1);
      const bootcampName = courseRes[0]?.name || '';

      // Role removal logic for previous instructor(s) using RBAC
      if (
        batch.instructorEmail &&
        batchOld[0].instructorId !== batchValue.instructorId
      ) {
        const potentialPrevIds = new Set<number>();
        if (batchOld[0].instructorId) {
          potentialPrevIds.add(batchOld[0].instructorId);
        }

        // If previousInstructorEmail is explicitly provided, include that user for role check
        if (batch.previousInstructorEmail) {
          try {
            const prevUser = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.email, batch.previousInstructorEmail))
              .limit(1);
            if (prevUser.length > 0) {
              potentialPrevIds.add(Number(prevUser[0].id));
            }
          } catch (err) {
            console.error('Failed to find previous instructor by email:', err);
          }
        }

        // Don't remove role from the NEW instructor if they were somehow in the previous set
        if (batchValue.instructorId) {
          potentialPrevIds.delete(batchValue.instructorId);
        }

        for (const previousInstructorId of potentialPrevIds) {
          try {
            const bootcampRefId = batchOld[0].bootcampId;
            const bootcamp = await db.query.zuvyBootcamps.findFirst({
              where: eq(zuvyBootcamps.id, bootcampRefId),
            });
            const orgId = bootcamp?.organizationId;

            // Count how many other batches this user has in this organization
            const otherBatchesInOrg = await db
              .select({ count: sql`count(*)` })
              .from(zuvyBatches)
              .innerJoin(
                zuvyBootcamps,
                eq(zuvyBatches.bootcampId, zuvyBootcamps.id),
              )
              .where(
                and(
                  eq(zuvyBatches.instructorId, previousInstructorId),
                  orgId
                    ? eq(zuvyBootcamps.organizationId, orgId)
                    : isNull(zuvyBootcamps.organizationId),
                  not(eq(zuvyBatches.id, id)),
                ),
              );

            const otherBatchesCount = Number(otherBatchesInOrg[0].count);

            if (otherBatchesCount === 0) {
              const instructorRole = await db
                .select({ id: zuvyUserRoles.id })
                .from(zuvyUserRoles)
                .where(
                  and(
                    eq(sql`lower(${zuvyUserRoles.name})`, 'instructor'),
                    isNull(zuvyUserRoles.orgId),
                  ),
                )
                .limit(1);

              const instructorRoleId = instructorRole[0]?.id;

              if (instructorRoleId) {
                const prevInstructorUserId = BigInt(previousInstructorId);
                console.log(
                  `Removing instructor role for user ID: ${previousInstructorId} in Org: ${orgId}`,
                );
                await db
                  .delete(zuvyUserRolesAssigned)
                  .where(
                    and(
                      eq(zuvyUserRolesAssigned.userId, prevInstructorUserId),
                      eq(zuvyUserRolesAssigned.roleId, instructorRoleId),
                      orgId
                        ? eq(zuvyUserRolesAssigned.organizationId, orgId)
                        : isNull(zuvyUserRolesAssigned.organizationId),
                    ),
                  );
              }
            }
          } catch (removeErr) {
            console.error(
              `Failed to remove instructor role for User ${previousInstructorId}:`,
              removeErr,
            );
          }
        }
      }

      return [
        null,
        {
          status: 'success',
          message: 'Batch updated successfully',
          code: 200,
          batch: updatedResp,
          bootcampName,
          before: {
            name: batchOld[0].name,
            capEnrollment: batchOld[0].capEnrollment,
            status: batchOld[0].status,
            startDate: batchOld[0].startDate,
            endDate: batchOld[0].endDate,
            instructorId: batchOld[0].instructorId,
          },
          data: updatedResp,
        },
      ];
    } catch (e) {
      log(`error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async deleteBatch(id: number) {
    try {
      // Fetch batch details before deletion for tracking log
      const batchToDelete = await db
        .select({ name: zuvyBatches.name, bootcampId: zuvyBatches.bootcampId })
        .from(zuvyBatches)
        .where(eq(zuvyBatches.id, id))
        .limit(1);

      await db
        .update(zuvyBatchEnrollments)
        .set({ batchId: null })
        .where(eq(zuvyBatchEnrollments.batchId, id))
        .returning();
      await db
        .delete(zuvyStudentAttendance)
        .where(eq(zuvyStudentAttendance.batchId, id));

      await db
        .delete(zuvyStudentAttendanceRecords)
        .where(eq(zuvyStudentAttendanceRecords.batchId, id));
      await db
        .delete(zuvySessions)
        .where(
          or(eq(zuvySessions.batchId, id), eq(zuvySessions.secondBatchId, id)),
        );
      let data = await db
        .delete(zuvyBatches)
        .where(eq(zuvyBatches.id, id))
        .returning();

      if (data.length === 0) {
        return [
          { status: 'error', message: 'Batch not found', code: 404 },
          null,
        ];
      }
      const courseRes = await db
        .select({ name: zuvyBootcamps.name })
        .from(zuvyBootcamps)
        .where(eq(zuvyBootcamps.id, batchToDelete[0]?.bootcampId))
        .limit(1);
      const bootcampName = courseRes[0]?.name || '';

      return [
        null,
        {
          status: 'success',
          message: 'Batch deleted successfully',
          code: 200,
          batchName: batchToDelete[0]?.name || null,
          bootcampId: batchToDelete[0]?.bootcampId || null,
          descriptionSuffix: bootcampName ? `from course ${bootcampName}` : '',
        },
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
          students: true,
        },
      });
      if (batchAssigned.length == 0) {
        return [
          { status: 'error', message: 'No batch found', code: 404 },
          null,
        ];
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

  async getNotEnrolledStudents(
    bootcampId: number,
    searchTerm: string,
  ): Promise<any> {
    try {
      const unenrolledUserIds = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(
          sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NULL`,
        )
        .orderBy(zuvyBatchEnrollments.id);

      const userIds = unenrolledUserIds.map((enrollment) =>
        BigInt(enrollment.userId),
      );

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
                  ilike(users.email, `${searchTerm}%`),
                )
              : undefined,
          ),
        )
        .orderBy(users.id);

      return [
        null,
        {
          status: 'success',
          message: 'Students not enrolled in any batch',
          statusCode: 200,
          data: usersData,
        },
      ];
    } catch (err) {
      return [{ status: 'error', message: err.message, code: 400 }, null];
    }
  }
}
