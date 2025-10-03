import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, count, inArray, or, and, like, desc, ne } from 'drizzle-orm';
import axios from 'axios';
import * as _ from 'lodash';
import { error, log } from 'console';
import {
  zuvyBootcamps,
  zuvyBatches,
  users,
  zuvyBatchEnrollments,
  zuvyBootcampTracking,
  zuvyBootcampType,
  zuvySessions,
  zuvyStudentAttendance,
  zuvyStudentAttendanceRecords,
  zuvyCourseModules,
  zuvyRecentBootcamp,
  zuvyModuleTracking,
  AttendanceStatus
} from '../../../drizzle/schema';
import { editUserDetailsDto } from './dto/bootcamp.dto'
import { batch } from 'googleapis/build/src/apis/batch';
import { STATUS_CODES } from 'src/helpers';
import { ContentService } from '../content/content.service';
import { RbacAllocPermsService } from '../../rbac/rbac.alloc-perms.service';
import { ResourceList } from 'src/rbac/utility';

const { ZUVY_CONTENT_URL } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class BootcampService {
  constructor(
    private contentService: ContentService,
    private rbacAllocPermsService: RbacAllocPermsService,
  ) { }
  async enrollData(bootcampId: number) {
    try {
      let enrolled = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId}`);
      const batchesData = await db
        .select()
        .from(zuvyBatches)
        .where(eq(zuvyBatches.bootcampId, bootcampId));

      const batchIds = batchesData.map((obj) => obj.id);
      let unEnrolledStudents = enrolled.length;
      if (batchIds.length != 0) {
        let unEnrolledBatch = await db
          .select()
          .from(zuvyBatchEnrollments)
          .where(
            sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId} AND ${inArray(zuvyBatchEnrollments.batchId, batchIds)}`,
          );
        unEnrolledStudents = unEnrolledStudents - unEnrolledBatch.length;
      }
      return [
        null,
        {
          students_in_bootcamp: enrolled.length,
          unassigned_students: unEnrolledStudents,
        },
      ];
    } catch (error) {
      log(`error: ${error.message}`);
      return [{ status: 'error', message: error.message, code: 500 }, null];
    }
  }

  async getAllBootcamps(
    roleName: string[],
    limit: number,
    offset: number,
    searchTerm?: string | number,
  ): Promise<any> {
    try {
      let query;
      let countQuery;
      if (searchTerm) {
        if (typeof searchTerm === 'string') {
          const searchCondition = sql`LOWER(${zuvyBootcamps.name}) LIKE ${searchTerm.toLowerCase()} || '%'`;
          query = db
            .select()
            .from(zuvyBootcamps)
            .where(searchCondition)
            .limit(limit)
            .offset(offset);
          countQuery = db
            .select({ count: count(zuvyBootcamps.id) })
            .from(zuvyBootcamps)
            .where(searchCondition);
        } else {
          const searchCondition = sql`${zuvyBootcamps.id} = ${searchTerm}`;
          query = db
            .select()
            .from(zuvyBootcamps)
            .where(searchCondition)
            .limit(limit)
            .offset(offset);
          countQuery = db
            .select({ count: count(zuvyBootcamps.id) })
            .from(zuvyBootcamps)
            .where(searchCondition);
        }
      } else {
        query = db.select().from(zuvyBootcamps).limit(limit).offset(offset);
        countQuery = db
          .select({ count: count(zuvyBootcamps.id) })
          .from(zuvyBootcamps);
      }

      const getBootcamps = await query;

      const totalCountQuery = await countQuery;
      const totalCount = totalCountQuery[0].count;

      const totalPages = Math.ceil(totalCount / limit);

      const targetPermissions = [
        ResourceList.course.create,
        ResourceList.course.read,
        ResourceList.course.edit,
        ResourceList.course.delete,
        ResourceList.question.read,
        ResourceList.rolesandpermission.read
      ]
      // Get permissions for all resources if userId is provided
      let allPermissions = {};
      const permissionResult = await this.rbacAllocPermsService.getAllPermissions(roleName, targetPermissions);
      allPermissions = permissionResult.permissions || {};

      const data = await Promise.all(
        getBootcamps.map(async (bootcamp) => {
          let [err, res] = await this.enrollData(bootcamp.id);
          if (err) {
            return [err, null];
          }

          return { ...bootcamp, ...res };
        }),
      );

      return [null, { data, permissions: allPermissions, totalBootcamps: totalCount, totalPages }];
    } catch (e) {
      log(`error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async getBootcampById(id: number, isContent: boolean, role: string[]): Promise<any> {
    try {
      let bootcamp = await db
        .select()
        .from(zuvyBootcamps)
        .where(sql`${zuvyBootcamps.id} = ${id}`);
      let [err, res] = await this.enrollData(id);

      if (!bootcamp.length) {
        return [
          { status: 'Error', message: 'Bootcamp not found!', code: 404 },
          null,
        ];
      }
      const targetPermissions = [
        ResourceList.course.edit,
        ResourceList.module.read,
        ResourceList.batch.read, 
        ResourceList.student.read,
        ResourceList.submission.read,
        ResourceList.setting.read
      ]
      const grantedPermissions = await this.rbacAllocPermsService.getAllPermissions(role, targetPermissions);
      return [
        null,
        {
          status: 'success',
          message: 'Bootcamp fetched successfully',
          code: 200,
          bootcamp: { ...bootcamp[0], ...res },
          ...grantedPermissions
        },
      ];
    } catch (e) {
      log(`error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async createBootcamp(bootcampData): Promise<any> {
    try {

      const existingBootcamp = await db
        .select()
        .from(zuvyBootcamps)
        .where(eq(zuvyBootcamps.name, bootcampData.name));

      if (existingBootcamp.length > 0) {
        return [
          {
            status: 'error',
            message: 'Course name already exists.',
            code: STATUS_CODES.BAD_REQUEST,
          },
          null,
        ];
      }

      let newBootcamp = await db
        .insert(zuvyBootcamps)
        .values(bootcampData)
        .returning();

      const bootcampTypeData = {
        bootcampId: newBootcamp[0].id,
        type: 'Private', // Assuming type is present in bootcampData
        isModuleLocked: false,
      };

      let insertedBootcampType = await db
        .insert(zuvyBootcampType)
        .values(bootcampTypeData)
        .execute();
      try {
        try {
          const response = await axios.post(ZUVY_CONTENT_URL, {
            data: {
              id: newBootcamp[0].id,
              name: newBootcamp[0].name,
            },
          });
          log(
            `Created the content in strapi with the name of ${newBootcamp[0].name},`,
          );
        } catch (error) {
          log(`Error posting data: ${error.message}`);
        }
      } catch (error) {
        log(`Error posting data: ${error.message}`);
        return [{ status: 'Error', message: error.message, code: STATUS_CODES.NOT_FOUND }, null];
      }
      log(`Bootcamp created successfully`);
      return [
        null,
        {
          status: 'success',
          message: 'Bootcamp created successfully',
          code: STATUS_CODES.OK,
          bootcamp: newBootcamp[0],
        },
      ];
    } catch (e) {
      log(`Error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 405 }, null];
    }
  }

  async updateBootcamp(id: number, bootcampData): Promise<any> {
    try {
      delete bootcampData.instructorId;
      let updatedBootcamp = await db
        .update(zuvyBootcamps)
        .set({ ...bootcampData })
        .where(eq(zuvyBootcamps.id, id))
        .returning();

      if (updatedBootcamp.length === 0) {
        return [
          { status: 'error', message: 'Bootcamp not found', code: 404 },
          null,
        ];
      }
      return [
        null,
        {
          status: 'success',
          message: 'Bootcamp updated successfully',
          code: 200,
          updatedBootcamp,
        },
      ];
    } catch (e) {
      log(`error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async updateBootcampSetting(bootcamp_id: number, settingData, roleName: string[]) {
    try {
      const typeOfBootcamp = settingData.type ? settingData.type.toLowerCase() : null;
      if (settingData.type) {
        settingData.type =
          settingData.type.charAt(0).toUpperCase() +
          settingData.type.slice(1).toLowerCase();
      }
      const targetPermissions = [
        ResourceList.setting.read,
        ResourceList.course.delete,
        ResourceList.module.lock,
        ResourceList.course.edit
      ]
      const grantedPermissions = await this.rbacAllocPermsService.getAllPermissions(roleName, targetPermissions);
      if (
        typeOfBootcamp == 'Public'.toLowerCase() ||
        typeOfBootcamp == 'Private'.toLowerCase() ||
        typeOfBootcamp === null
      ) {
        let updatedBootcampSetting = await db
          .update(zuvyBootcampType)
          .set({ ...settingData })
          .where(eq(zuvyBootcampType.bootcampId, bootcamp_id))
          .returning();

        if (updatedBootcampSetting.length === 0) {
          return [
            {
              status: 'error',
              message: 'Bootcamp not found for the provided id',
              code: 404,
              ...grantedPermissions
            },
            null,
          ];
        }
        return [
          null,
          {
            status: 'success',
            message: 'Bootcamp Type updated successfully',
            code: 200,
            updatedBootcampSetting,
            ...grantedPermissions
          },
        ];
      } else {
        return [
          null,
          {
            status: 'success',
            message: `Course type can be of type Public or Private`,
            code: 200,
            ...grantedPermissions
          },
        ];
      }
    } catch (e) {
      log(`error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async getBootcampSettingById(bootcampId: number) {
    try {
      let bootcampSetting = await db
        .select()
        .from(zuvyBootcampType)
        .where(eq(zuvyBootcampType.bootcampId, bootcampId));

      if (bootcampSetting.length === 0) {
        return [
          {
            status: 'error',
            message: 'Bootcamp not found for the provided id.',
            code: 404,
          },
          null,
        ];
      }
      return [
        null,
        {
          status: 'success',
          message: 'Bootcamp setting details achieved',
          code: 200,
          bootcampSetting,
        },
      ];
    } catch (e) {
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async deleteBootcamp(id: number): Promise<any> {
    try {
      // Delete all modules for this bootcamp
      const modules = await db.select().from(zuvyCourseModules).where(eq(zuvyCourseModules.bootcampId, id));
      for (const module of modules) {
        await this.contentService.deleteModule(module.id, id);
      }
      // Delete from bootcamp setting/type
      await db.delete(zuvyBootcampType).where(eq(zuvyBootcampType.bootcampId, id));
      // Delete from bootcamp tracking
      await db.delete(zuvyBootcampTracking).where(eq(zuvyBootcampTracking.bootcampId, id));
      // Delete from recent bootcamp
      await db.delete(zuvyRecentBootcamp).where(eq(zuvyRecentBootcamp.bootcampId, id));
      // Delete student attendance for this bootcamp
      await db.delete(zuvyStudentAttendance).where(eq(zuvyStudentAttendance.bootcampId, id));

      await db.delete(zuvyModuleTracking).where(eq(zuvyModuleTracking.bootcampId, id));
      // Delete batches and enrollments
      await db.delete(zuvyBatches).where(eq(zuvyBatches.bootcampId, id));
      await db.delete(zuvyBatchEnrollments).where(eq(zuvyBatchEnrollments.bootcampId, id));
      // Finally, delete the bootcamp
      let data = await db.delete(zuvyBootcamps).where(eq(zuvyBootcamps.id, id)).returning();
      if (data.length === 0) {
        return [
          { status: 'error', message: 'Bootcamp not found', code: 404 },
          null,
        ];
      }
      return [
        null,
        {
          status: 'success',
          message: 'Bootcamp deleted successfully',
          code: 200,
        },
      ];
    } catch (error) {
      log(`error: ${error.message}`);
      return [{ status: 'error', message: error.message, code: 404 }, null];
    }
  }

  async getBatchByIdBootcamp(
    bootcamp_id: number,
    roleName: string[],
    limit: number,
    offset: number,
  ): Promise<any> {
    try {
      console.log({ bootcamp_id, limit, offset });

      // sanitize pagination parameters
      const limitNum = Number.isFinite(Number(limit)) ? Number(limit) : undefined;
      const offsetNum = Number.isFinite(Number(offset)) ? Number(offset) : undefined;

      // build query using a loose-typed builder to avoid TS generic reassign issues
      // select explicit columns to avoid referencing columns that may not exist in some DB schemas
      const baseQuery: any = db
        .select({
          id: zuvyBatches.id,
          name: zuvyBatches.name,
          bootcampId: zuvyBatches.bootcampId,
          instructorId: zuvyBatches.instructorId,
          capEnrollment: zuvyBatches.capEnrollment,
          createdAt: zuvyBatches.createdAt,
          updatedAt: zuvyBatches.updatedAt,
          status: zuvyBatches.status,
          startDate: zuvyBatches.startDate,
          endDate: zuvyBatches.endDate,
        })
        .from(zuvyBatches)
        .where(eq(zuvyBatches.bootcampId, bootcamp_id));
      let queryBuilder: any = baseQuery;
      if (limitNum !== undefined) queryBuilder = queryBuilder.limit(limitNum);
      if (offsetNum !== undefined) queryBuilder = queryBuilder.offset(offsetNum);

      const batchesData = await queryBuilder;

      const totalCountQuery = await db
        .select({ count: count(zuvyBatches.id) })
        .from(zuvyBatches)
        .where(eq(zuvyBatches.bootcampId, bootcamp_id));
      const totalCount = totalCountQuery[0]?.count || 0;
      const totalPages = limitNum && limitNum > 0 ? Math.ceil(totalCount / limitNum) : 1;

      const promises = batchesData.map(async (batch) => {
        // students enrolled
        const userEnrolled = await db
          .select()
          .from(zuvyBatchEnrollments)
          .where(
            sql`${zuvyBatchEnrollments.batchId} = ${batch.id} and ${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id}`,
          );
        batch['students_enrolled'] = userEnrolled.length;

        // instructor info (id and email)
        const instrId = batch.instructorId ?? null;
        if (instrId) {
          const instr = await db
            .select({ id: users.id, email: users.email })
            .from(users)
            .where(eq(users.id, BigInt(instrId)))
            .limit(1);
          if (instr.length) {
            batch['instructorId'] = Number(instr[0].id as any);
            batch['instructorEmail'] = instr[0].email;
          } else {
            batch['instructorEmail'] = null;
          }
        } else {
          batch['instructorId'] = null;
          batch['instructorEmail'] = null;
        }

        // duration fields and status (prefer DB status if set)
        batch['startDate'] = batch['startDate'] ? new Date(String(batch['startDate'])).toISOString() : null;
        batch['endDate'] = batch['endDate'] ? new Date(String(batch['endDate'])).toISOString() : null;
        batch['status'] = batch['status'] ? batch['status'] : (batch['endDate'] && new Date(String(batch['endDate'])) < new Date() ? 'Completed' : 'Ongoing');

        return batch; // return the modified batch
      });
      const data = await Promise.all(promises);
      const targetPermissions = [
        ResourceList.batch.read,
        ResourceList.batch.create,
        ResourceList.batch.edit,
        ResourceList.batch.delete
      ]
      const grantedPermission = await this.rbacAllocPermsService.getAllPermissions(roleName, targetPermissions);
      return [null, { data, ...grantedPermission, totalBatches: totalCount, totalPages }];
    } catch (e) {
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async searchBatchByIdBootcamp(
    bootcamp_id: number,
    searchTerm: string,
  ): Promise<any> {
    try {
      const batchesData = await db
        .select({
          id: zuvyBatches.id,
          name: zuvyBatches.name,
          bootcampId: zuvyBatches.bootcampId,
          instructorId: zuvyBatches.instructorId,
          capEnrollment: zuvyBatches.capEnrollment,
          createdAt: zuvyBatches.createdAt,
          updatedAt: zuvyBatches.updatedAt,
          status: zuvyBatches.status,
          startDate: zuvyBatches.startDate,
          endDate: zuvyBatches.endDate,
        })
        .from(zuvyBatches)
        .where(
          sql`${zuvyBatches.bootcampId}=${bootcamp_id} AND (LOWER(${zuvyBatches.name}) LIKE ${searchTerm.toLowerCase()} || '%')`,
        );

      const promises = batchesData.map(async (batch) => {
        const userEnrolled = await db
          .select()
          .from(zuvyBatchEnrollments)
          .where(
            sql`${zuvyBatchEnrollments.batchId} = ${batch.id} and ${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id}`,
          );
        batch['students_enrolled'] = userEnrolled.length;

        // instructor info
        const instrId = batch.instructorId ?? null;
        if (instrId) {
          const instr = await db
            .select({ id: users.id, email: users.email })
            .from(users)
            .where(eq(users.id, BigInt(instrId)))
            .limit(1);
          if (instr.length) {
            batch['instructorId'] = Number(instr[0].id as any);
            batch['instructorEmail'] = instr[0].email;
          } else {
            batch['instructorEmail'] = null;
          }
        } else {
          batch['instructorId'] = null;
          batch['instructorEmail'] = null;
        }

        batch['startDate'] = batch['startDate'] ? new Date(String(batch['startDate'])).toISOString() : null;
        batch['endDate'] = batch['endDate'] ? new Date(String(batch['endDate'])).toISOString() : null;
        batch['status'] = batch['status'] ? batch['status'] : (batch['endDate'] && new Date(String(batch['endDate'])) < new Date() ? 'Completed' : 'Ongoing');
        batch['status'] = batch['endDate'] && new Date(String(batch['endDate'])) < new Date() ? 'Completed' : 'Ongoing';

        return batch; // return the modified batch
      });
      const batchesWithEnrollment = await Promise.all(promises);
      return [null, batchesWithEnrollment];
    } catch (e) {
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async addStudentToBootcamp(
    bootcampId: number,
    batchId: number,
    users_data: any[],
    roleName: string[]
  ) {
    try {
      var a = 0, b = 0, c = 0, d = 0;
      let enrollments = [];
      let bootcampData = await db
        .select()
        .from(zuvyBootcamps)
        .where(sql`${zuvyBootcamps.id} = ${bootcampId}`);
      if (bootcampData.length === 0) {
        return [
          { status: 'error', message: 'Bootcamp not found', code: 404 },
          null,
        ];
      }
      var batch;
      if (batchId) {
        batch = await db
          .select()
          .from(zuvyBatches)
          .where(sql`${zuvyBatches.id} = ${batchId} AND ${zuvyBatches.bootcampId} = ${bootcampId}`);
        if (batch.length === 0) {
          return [
            { status: 'error', message: 'Batch not found', code: 404 },
            null,
          ];
        }

        let totalstudents = await db
          .select()
          .from(zuvyBatchEnrollments)
          .where(sql`${zuvyBatchEnrollments.batchId} = ${batchId}`);

        if (totalstudents.length + users_data.length > batch[0].capEnrollment) {
          return [
            {
              status: 'error',
              message: 'The maximum capacity for the batch has been reached',
              code: 400,
            },
            null,
          ];
        }
      }

      if (!Array.isArray(users_data) || users_data.length === 0) {
        return [{
          status: 'error',
          code: 400,
          message: 'The student list is empty. Add student to enroll in the course',
        }];
      }

      if (users_data.length == 1) {
        let userData = await db
          .select()
          .from(users)
          .where(sql`${users.email} = ${users_data[0].email}`);
        if (userData.length >= 1) {
          // Update name if different
          if (userData[0].name !== users_data[0].name) {
            await db
              .update(users)
              .set({ name: users_data[0].name })
              .where(sql`${users.email} = ${users_data[0].email}`);
          }
        }
        if (userData.length >= 1 && batchId) {
          let enrollUser = await db
            .select()
            .from(zuvyBatchEnrollments)
            .where(
              sql`${zuvyBatchEnrollments.userId} = ${userData[0].id} and ${zuvyBatchEnrollments.batchId} = ${batchId}`,
            );
          if (enrollUser.length != 0) {
            return [
              {
                status: 'error',
                message: 'The user is already enrolled in this batch.',
                code: 407,
              },
              null,
            ];
          }
        } else if (userData.length >= 1 && bootcampId) {
          let enrollUser = await db
            .select()
            .from(zuvyBatchEnrollments)
            .where(
              sql`${zuvyBatchEnrollments.userId} = ${userData[0].id} and ${zuvyBatchEnrollments.bootcampId} = ${bootcampId} `,
            );
          if (enrollUser.length != 0) {
            return [
              {
                status: 'error',
                message: 'The user is already enrolled in this bootcamp.',
                code: 407,
              },
              null,
            ];
          }
        }
      }

      let report = [];
      let userReport = [];
      for (let i = 0; i < users_data.length; i++) {
        let newUser = {};
        newUser['bootcamp_id'] = bootcampId;

        if (!isNaN(batchId)) {
          newUser['batch_id'] = batchId;
        }
        newUser['email'] = users_data[i]['email'];
        newUser['name'] = users_data[i]['name'];
        let enroling;
        let userInfo = await db
          .select()
          .from(users)
          .where(sql`${users.email} = ${users_data[i]['email']}`);
        if (userInfo.length > 0) {
          // Update name if different
          if (userInfo[0].name !== users_data[i]['name']) {
            await db
              .update(users)
              .set({ name: users_data[i]['name'] })
              .where(sql`${users.email} = ${users_data[i]['email']}`);
          }
        }
        if (userInfo.length === 0) {
          userInfo = await db.insert(users).values(newUser).returning();
          c += 1;
          enroling = { userId: userInfo[0].id, bootcampId };
          if (batchId) {
            enroling['batchId'] = batchId;
          }
          userReport.push({
            email: userInfo[0].email,
            message: `enrolled successfully`,
          });
          enrollments.push(enroling);
        } else if (userInfo.length > 0) {
          let userEnrolled = await db
            .select()
            .from(zuvyBatchEnrollments)
            .where(
              sql`${zuvyBatchEnrollments.userId
                } = ${BigInt(userInfo[0].id)} AND ${zuvyBatchEnrollments.bootcampId
                } = ${bootcampId}`,
            );
          if (userEnrolled.length > 0 && !isNaN(batchId) && (userEnrolled[0].batchId == null || userEnrolled[0].batchId != batchId)) {
            let updateEnrol = await db
              .update(zuvyBatchEnrollments)
              .set({ batchId })
              .where(
                sql`${zuvyBatchEnrollments.userId
                  } = ${BigInt(userInfo[0].id)} AND ${zuvyBatchEnrollments.bootcampId
                  } = ${bootcampId}`,
              )
              .returning();
            if (updateEnrol.length !== 0) {
              a += 1;
              userReport.push({
                email: userInfo[0].email,
                message: `The student has been assigned to ${batch[0].name}`,
              });
              continue;
            }
            continue;
          }
          else if (userEnrolled.length > 0 && !isNaN(batchId) && userEnrolled[0].batchId == batchId) {
            d += 1;
            userReport.push({
              email: userInfo[0].email,
              message: `The student has been already assigned to ${batch[0].name}`,
            });
          }
          else if (userEnrolled.length > 0 && isNaN(batchId)) {
            b += 1;
            userReport.push({
              email: userInfo[0].email,
              message: `The students have been already enrolled!!!`,
            });
          }
          else if (userEnrolled.length == 0) {
            c += 1;
            const now = new Date();
            enroling = {
              userId: userInfo[0].id,
              bootcampId,
              enrolledDate: now,
              lastActiveDate: now,
              status: 'active',
            };
            if (batchId) {
              enroling['batchId'] = batchId;
            }
            userReport.push({
              email: userInfo[0].email,
              message: `enrolled successfully`,
            });
            enrollments.push(enroling);
          }
        }
      }

      let students_enrolled;
      if (enrollments.length > 0) {
        students_enrolled = await db
          .insert(zuvyBatchEnrollments)
          .values(enrollments)
          .returning();
        if (students_enrolled.length === 0) {
          return [
            { status: 'error', message: 'Error enrolling students', code: 407 },
            null,
          ];
        }
      }

      let messageParts = [];

      if (c > 0) {
        messageParts.push(`${c} students successfully enrolled`);
      }

      if (b > 0) {
        messageParts.push(`${b} students has been already enrolled`);
      }

      if (a > 0) {
        messageParts.push(`${a} students has been assigned to the batch`);
      }
      if (d > 0) {
        messageParts.push(`${d} students has been already enrolled in this particular batch`)
      }

      let message = messageParts.join(' & ');
      const targetePermission = [
        ResourceList.student.read,
        ResourceList.student.create,
        ResourceList.student.edit,
        ResourceList.student.delete
      ]
      const grantedPermissions = await this.rbacAllocPermsService.getAllPermissions(roleName, targetePermission);

      return [
        null,
        {
          status: 'success',
          code: 200,
          message: message,
          students_enrolled: userReport,
          ...grantedPermissions
        },
      ];
    } catch (e) {
      log(`error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }


  async BootcampOrBatchEnrollments(batch_id: number, bootcamp_id: number, user_id = null) {
    let queryString;

    if (user_id && batch_id && bootcamp_id) {
      queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} and ${zuvyBatchEnrollments.batchId} = ${batch_id} and ${zuvyBatchEnrollments.userId} = ${user_id}`;
    } else if (bootcamp_id && batch_id) {
      queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} and ${zuvyBatchEnrollments.batchId} = ${batch_id}`;
    } else {
      queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id}`;
    }
    return queryString;
  }



  async getStudentsInABootcamp(
    bootcampId,
    batchId,
    searchTerm: string | bigint = '',
    limit: number,
    offset: number,
    enrolledDate?: string,
    lastActiveDate?: string,
    status?: string,
    attendance?: number,
    orderBy?: string,
    orderDirection?: string
  ) {
    try {
      console.log({ bootcampId, batchId, searchTerm, limit, offset, enrolledDate, lastActiveDate, status, attendance });

      // sanitize numeric inputs to avoid sending NaN to SQL (Postgres will error on 'NaN' for integer fields)
      const batchIdNum = Number.isFinite(Number(batchId)) ? Number(batchId) : undefined;
      const limitNum = Number.isFinite(Number(limit)) ? Number(limit) : undefined;
      const offsetNum = Number.isFinite(Number(offset)) ? Number(offset) : undefined;
      const attendanceNum = Number.isFinite(Number(attendance)) ? Number(attendance) : undefined;

      const batchFilter = batchIdNum !== undefined ? eq(zuvyBatchEnrollments.batchId, batchIdNum) : undefined;
      const attendanceFilter = attendanceNum !== undefined ? eq(zuvyBatchEnrollments.attendance, attendanceNum) : undefined;
      const searchFilter = (searchTerm && typeof searchTerm === 'string' && searchTerm.trim() !== '')
        ? sql`(LOWER(${users.name}) LIKE ${searchTerm.toLowerCase()} || '%' OR LOWER(${users.email}) LIKE ${searchTerm.toLowerCase()} || '%')`
        : undefined;
      const enrolledDateFilter = enrolledDate ? sql`DATE(${zuvyBatchEnrollments.enrolledDate}) = ${enrolledDate}` : undefined;
      const lastActiveDateFilter = lastActiveDate ? sql`DATE(${zuvyBatchEnrollments.lastActiveDate}) = ${lastActiveDate}` : undefined;
      const statusFilter = status ? eq(zuvyBatchEnrollments.status, status) : undefined;
      console.log({ orderBy, orderDirection });
      // Determine order field and direction
      let orderField;
      switch (orderBy) {
        case 'submittedDate':
          orderField = zuvyBatchEnrollments.enrolledDate;
          break;
        case 'percentage':
          orderField = zuvyBootcampTracking.progress;
          break;
        case 'name':
          orderField = users.name;
          break;
        case 'email':
          orderField = users.email;
          break;
        default:
          orderField = users.name;
      }
      const direction = orderDirection === 'desc' ? desc(orderField) : orderField;
      const query = db.select({
        userId: users.id,
        name: users.name,
        email: users.email,
        profilePicture: users.profilePicture,
        bootcampId: zuvyBatchEnrollments.bootcampId,
        attendance: zuvyBatchEnrollments.attendance,
        enrolledDate: sql`zuvy_batch_enrollments.enrolled_date`,
        lastActiveDate: sql`zuvy_batch_enrollments.last_active_date`,
        status: sql`zuvy_batch_enrollments.status`,
        batchName: zuvyBatches.name,
        batchId: zuvyBatches.id,
        progress: zuvyBootcampTracking.progress,
        zuvyBootcampTrackingId: zuvyBootcampTracking.id,
        zuvyBatchEnrollmentsId: zuvyBatchEnrollments.id,

      })
        .from(zuvyBatchEnrollments)
        .leftJoin(users, eq(zuvyBatchEnrollments.userId, users.id))
        .leftJoin(zuvyBatches, eq(zuvyBatchEnrollments.batchId, zuvyBatches.id))
        .leftJoin(zuvyBootcampTracking, and(
          eq(zuvyBootcampTracking.userId, zuvyBatchEnrollments.userId),
          eq(zuvyBootcampTracking.bootcampId, zuvyBatchEnrollments.bootcampId)
        ))
        .where(and(
          eq(zuvyBatchEnrollments.bootcampId, bootcampId),
          batchFilter,
          searchFilter,
          enrolledDateFilter,
          lastActiveDateFilter,
          statusFilter,
          attendanceFilter
        ))
        .orderBy(direction);

      const mapData = await query;
      const totalNumberOfStudents = mapData.length;
      const hasPagination = Number.isFinite(limitNum) && Number.isFinite(offsetNum);
      const studentsInfo = hasPagination ? mapData.slice(offsetNum, offsetNum + limitNum) : mapData;

      // For each student, fetch their attendance records
      const modifiedStudentInfo = await Promise.all(studentsInfo.map(async (item) => {
        console.log({ item });
        return {
          ...item,
          userId: Number(item.userId),
          attendance: item.attendance,
          batchName: item.batchId != null ? item.batchName : 'unassigned',
          progress: item.progress != null ? item.progress : 0,
          enrolledDate: item.enrolledDate ? new Date(String(item.enrolledDate)).toISOString() : null,
          lastActiveDate: item.lastActiveDate ? new Date(String(item.lastActiveDate)).toISOString() : null,
          status: item.status || null,
          zuvyBatchEnrollmentsId: item.zuvyBatchEnrollmentsId || null,
          zuvyBootcampTrackingId: item.zuvyBootcampTrackingId || null
        };
      }));
      const currentPage = hasPagination ? Math.floor(offsetNum / limitNum) + 1 : 1;
      const totalPages = Number.isFinite(limitNum) && limitNum > 0 ? Math.ceil(totalNumberOfStudents / limitNum) : 1;
      return {
        status: 'success',
        code: 200,
        modifiedStudentInfo,
        totalNumberOfStudents,
        currentPage,
        totalPages,
      };
    } catch (err) {
      throw err;
    }
  }

  async getStudentProgressBy(userId: number, bootcampId: number) {
    try {
      let bootcampData = await db
        .select()
        .from(zuvyBootcamps)
        .where(sql`${zuvyBootcamps.id} = ${bootcampId}`);
      if (bootcampData.length === 0) {
        return [
          { status: 'error', message: 'Bootcamp not found', code: 404 },
          null,
        ];
      }
      let progressInfo = await db
        .select()
        .from(zuvyBootcampTracking)
        .where(
          sql`${zuvyBootcampTracking.userId}= ${userId} and ${zuvyBootcampTracking.bootcampId} = ${bootcampId}`,
        );
      let batchInfo = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(
          sql`${zuvyBatchEnrollments.userId}= ${userId} and ${zuvyBatchEnrollments.bootcampId} = ${bootcampId}`,
        );

      if (batchInfo.length > 0) {
        let batch = await db
          .select()
          .from(zuvyBatches)
          .where(sql`${zuvyBatches.id} = ${batchInfo[0].batchId}`);
        let user = await db
          .select()
          .from(users)
          .where(sql`${users.id} = ${batch[0].instructorId}`);
        if (user.length > 0) {
          return [
            null,
            {
              status: 'success',
              info: {
                progress: progressInfo[0]?.progress || 0,
                bootcamp_id: bootcampData[0].id,
                bootcamp_name: bootcampData[0].name,
                instructor_name: user[0].name,
                instructor_profile_picture: user[0].profilePicture,
              },
              code: 200,
            },
          ];
        }
      }

      return [
        { status: 'error', message: 'No progress found', code: 404 },
        null,
      ];
    } catch (e) {
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async updateUserDetails(
    userId: number,
    editUserDetailsDto: editUserDetailsDto,
  ): Promise<[string | null, any]> {
    try {
      console.log({ userId, editUserDetailsDto });
      // Validate user existence in the users table
      const userExists = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.id, BigInt(userId)))
        .limit(1);

      if (!userExists.length) {
        return [null, { message: 'User not found', statusCode: STATUS_CODES.NOT_FOUND }];
      }

      // Check if no fields are provided to update
      if (!editUserDetailsDto.name && !editUserDetailsDto.email) {
        return [null, { message: 'No fields to update', statusCode: STATUS_CODES.BAD_REQUEST }];
      }

      // Prepare update data
      const updateData: { name?: string; email?: string; googleUserId?: string } = {};

      if (editUserDetailsDto.name) {
        updateData.name = editUserDetailsDto.name;
      }
      if (editUserDetailsDto.email) {
        updateData.email = editUserDetailsDto.email;
        if (editUserDetailsDto.email !== userExists[0].email) {
          updateData.googleUserId = null
        }
      }

      // Update user details in the users table
      const updatedUser = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, BigInt(userId)))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
        });

      if (!updatedUser.length) {
        return [null, { message: 'Failed to update user details', statusCode: STATUS_CODES.INTERNAL_SERVER_ERROR }];
      }

      // Convert BigInt to number
      const userData = {
        ...updatedUser[0],
        id: Number(updatedUser[0].id),
      };

      // If enrollment update provided, support both old nested shape (enrollment + bootcampId)
      // and the new flat shape (status, batchId, bootcampId). We try to locate the
      // enrollment by the most specific identifier available (batchId > bootcampId)
      // and then apply status / batch changes as requested.
      // Cast DTO to any for optional/legacy fields that may not be present in type
      const dtoAny = editUserDetailsDto as any;

      if (
        dtoAny.enrollment ||
        dtoAny.bootcampId ||
        dtoAny.status ||
        dtoAny.batchId
      ) {
        try {
          // Build enrollment filter
          let enrollmentFilter: any = null;

          if (dtoAny.enrollment && dtoAny.enrollment.bootcampId) {
            enrollmentFilter = sql`${zuvyBatchEnrollments.userId} = ${BigInt(userId)} AND ${zuvyBatchEnrollments.bootcampId} = ${dtoAny.enrollment.bootcampId}`;
          } else if (dtoAny.batchId !== undefined && dtoAny.batchId !== null && dtoAny.batchId !== '') {
            // match by batchId when provided in the flat payload
            enrollmentFilter = sql`${zuvyBatchEnrollments.userId} = ${BigInt(userId)} AND ${zuvyBatchEnrollments.batchId} = ${BigInt(dtoAny.batchId)}`;
          } else if (dtoAny.bootcampId !== undefined && dtoAny.bootcampId !== null && dtoAny.bootcampId !== '') {
            enrollmentFilter = sql`${zuvyBatchEnrollments.userId} = ${BigInt(userId)} AND ${zuvyBatchEnrollments.bootcampId} = ${dtoAny.bootcampId}`;
          }

          if (!enrollmentFilter) {
            // Nothing to identify an enrollment; skip enrollment update silently
          } else {
            const enrollmentRows = await db.select().from(zuvyBatchEnrollments).where(enrollmentFilter).limit(1);
            if (!enrollmentRows.length) {
              // Enrollment not found; return a 404-like response in the payload
              return [null, {
                message: 'User updated but enrollment not found for provided identifier',
                statusCode: STATUS_CODES.NOT_FOUND,
                data: userData,
              }];
            }

            const enrollmentUpdateData: any = {};
            // status can be provided either as top-level `status` or inside `enrollment.status`
            const statusVal = dtoAny.status ?? dtoAny.enrollment?.status;
            if (statusVal) {
              enrollmentUpdateData.status = statusVal;
            }

            // Allow changing batch assignment when a new batchId is provided (flat payload)
            if (dtoAny.batchId !== undefined && dtoAny.batchId !== null && dtoAny.batchId !== '') {
              const currentBatchId = enrollmentRows[0].batchId;
              if (Number(currentBatchId) !== Number(dtoAny.batchId)) {
                enrollmentUpdateData.batchId = BigInt(dtoAny.batchId);
              }
            }

            if (Object.keys(enrollmentUpdateData).length > 0) {
              await db.update(zuvyBatchEnrollments)
                .set(enrollmentUpdateData)
                .where(enrollmentFilter)
                .returning();
            }
          }
        } catch (err) {
          return [null, { message: 'Failed to update enrollment: ' + err.message, statusCode: STATUS_CODES.BAD_REQUEST }];
        }
      }

      return [
        null,
        {
          message: 'User details updated successfully',
          statusCode: STATUS_CODES.OK,
          data: userData,
        },
      ];
    } catch (err) {
      return [null, { message: err.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  async getUserPermissionsForMultipleResources(userId: bigint) {
    try {
      const result = await this.rbacAllocPermsService.getUserPermissionsForMultipleResources(userId);
      return [null, result];
    } catch (err) {
      return [err, null];
    }
  }

  async processAttendanceRecords(bootcampId: number) {
    try {
      let totalSessionsProcessed = 0;
      let totalSessionsWithAttendance = 0;
      let totalPresentStudents = 0;
      let totalEnrollmentsUpdated = 0;

      // Step 1: Fetch all sessions for the bootcamp
      const sessions = await db
        .select({
          id: zuvySessions.id,
          name: zuvySessions.title,
          meetingId: zuvySessions.meetingId
        })
        .from(zuvySessions)
        .where(eq(zuvySessions.bootcampId, bootcampId));

      totalSessionsProcessed = sessions.length;
      Logger.log(`Found ${sessions.length} sessions for bootcamp_id = ${bootcampId}`);

      // Step 2: Reset all attendance counts
      await db.update(zuvyBatchEnrollments)
        .set({ attendance: 0 })
        .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId));

      const attendanceMap = new Map<number, number>(); // userId -> attendance count

      // Step 3: Process each session
      for (const session of sessions) {
        const attendanceRecords = await db
          .select({ attendance: zuvyStudentAttendance.attendance })
          .from(zuvyStudentAttendance)
          .where(eq(zuvyStudentAttendance.meetingId, session.meetingId));

        if (!attendanceRecords.length) {
          Logger.log(`No attendance records for session ID: ${session.id}, meeting ID: ${session.meetingId}`);
          continue;
        }

        let sessionHasAttendance = false;

        for (const record of attendanceRecords) {
          let attendanceData;
          if (typeof record.attendance === 'object') {
            attendanceData = record.attendance;
          } else {
            try {
              attendanceData = JSON.parse(record.attendance as any);
            } catch (error) {
              Logger.error('Error parsing attendance data:', error);
              continue;
            }
          }

          if (!Array.isArray(attendanceData)) continue;

          for (const student of attendanceData) {
            if (!student.email?.trim() || student.attendance !== 'present') continue;

            sessionHasAttendance = true;
            totalPresentStudents++;

            const userRecords = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.email, student.email.trim().toLowerCase()));

            if (!userRecords.length) {
              Logger.log(`No user found with email: ${student.email}`);
              continue;
            }

            const userId = Number(userRecords[0].id);

            // Confirm enrollment exists
            const enrollment = await db.select()
              .from(zuvyBatchEnrollments)
              .where(and(eq(zuvyBatchEnrollments.userId, BigInt(userId)), eq(zuvyBatchEnrollments.bootcampId, bootcampId)));

            if (!enrollment.length) {
              Logger.log(`No enrollment found for user ID: ${userId} in bootcamp ID: ${bootcampId}`);
              continue;
            }

            // Count this attendance
            attendanceMap.set(userId, (attendanceMap.get(userId) || 0) + 1);
          }
        }

        if (sessionHasAttendance) {
          totalSessionsWithAttendance++;
        }
      }

      // Step 4: Apply batch updates per user
      for (const [userId, count] of attendanceMap.entries()) {
        await db.update(zuvyBatchEnrollments)
          .set({ attendance: count })
          .where(and(
            eq(zuvyBatchEnrollments.userId, BigInt(userId)),
            eq(zuvyBatchEnrollments.bootcampId, bootcampId)
          ));
        totalEnrollmentsUpdated++;
      }

      return [null, {
        totalSessionsProcessed,
        totalSessionsWithAttendance,
        totalPresentStudents,
        totalEnrollmentsUpdated,
        message: 'Attendance processing completed successfully'
      }];
    } catch (err) {
      return [err, null];
    }
  }

  async markAttendance(attendanceMarkDto: any) {
    try {
      if (!Array.isArray(attendanceMarkDto)) {
        attendanceMarkDto = [attendanceMarkDto];
      }
      const results = [];
      for (const record of attendanceMarkDto) {
        const { sessionId, userId, status, duration } = record;

        // Validate session exists and get bootcampId
        const sessions = await db.select({ id: zuvySessions.id, bootcampId: zuvySessions.bootcampId })
          .from(zuvySessions)
          .where(eq(zuvySessions.id, sessionId));
        if (!sessions.length) {
          results.push({ userId, sessionId, error: 'Session not found', code: 404 });
          continue;
        }
        const bootcampId = sessions[0].bootcampId;

        // Upsert into zuvyStudentAttendanceRecords
        const existing = await db.select().from(zuvyStudentAttendanceRecords)
          .where(sql`${zuvyStudentAttendanceRecords.sessionId} = ${sessionId} AND ${zuvyStudentAttendanceRecords.userId} = ${userId}`)
          .limit(1);

        if (existing.length) {
          await db.update(zuvyStudentAttendanceRecords)
            .set({ status, duration } as any)
            .where(sql`${zuvyStudentAttendanceRecords.sessionId} = ${sessionId} AND ${zuvyStudentAttendanceRecords.userId} = ${userId}`);
        } else {
          await db.insert(zuvyStudentAttendanceRecords).values({ sessionId, userId, status, duration } as any).returning();
        }

        // Recompute aggregate attendance for this user's enrollment in the bootcamp
        const presentCountQuery = await db.select({ count: sql<number>`cast(count(${zuvyStudentAttendanceRecords.id}) as int)` })
          .from(zuvyStudentAttendanceRecords)
          .leftJoin(zuvySessions, eq(zuvyStudentAttendanceRecords.sessionId, zuvySessions.id))
          .where(sql`${zuvyStudentAttendanceRecords.userId} = ${userId} AND ${zuvySessions.bootcampId} = ${bootcampId} AND ${zuvyStudentAttendanceRecords.status} = 'present'`);

        const presentCount = presentCountQuery[0]?.count || 0;

        // Update zuvyBatchEnrollments.attendance for this user's enrollments in this bootcamp
        await db.update(zuvyBatchEnrollments)
          .set({ attendance: presentCount })
          .where(sql`${zuvyBatchEnrollments.userId} = ${BigInt(userId)} AND ${zuvyBatchEnrollments.bootcampId} = ${bootcampId}`);

        results.push({ userId, sessionId, message: 'Attendance marked successfully', code: 200, attendance: presentCount });
      }
      return [null, results];
    } catch (err) {
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }

  async markStudentAttendance(
    bootcampId: number,
    sessionId: number,
    userId: number,
    status: string,
  ) {
    try {
      // Validate session exists and belongs to the bootcamp
      const sessions = await db.select({
        id: zuvySessions.id,
        bootcampId: zuvySessions.bootcampId,
        batchId: zuvySessions.batchId
      })
        .from(zuvySessions)
        .where(and(
          eq(zuvySessions.id, sessionId),
          eq(zuvySessions.bootcampId, bootcampId)
        ));

      if (!sessions.length) {
        return {
          status: 'error',
          message: 'Session not found or does not belong to the specified bootcamp',
          code: 404,
        };
      }

      const session = sessions[0];

      // Validate user is enrolled in the bootcamp
      const enrollment = await db.select()
        .from(zuvyBatchEnrollments)
        .where(and(
          eq(zuvyBatchEnrollments.userId, BigInt(userId)),
          eq(zuvyBatchEnrollments.bootcampId, bootcampId)
        ));

      if (!enrollment.length) {
        return {
          status: 'error',
          message: 'User is not enrolled in this bootcamp',
          code: 404,
        };
      }

      // Check if attendance record already exists
      const existing = await db.select()
        .from(zuvyStudentAttendanceRecords)
        .where(and(
          eq(zuvyStudentAttendanceRecords.sessionId, sessionId),
          eq(zuvyStudentAttendanceRecords.userId, userId)
        ))
        .limit(1);

      if (existing.length) {
        // Update existing record
        await db.update(zuvyStudentAttendanceRecords)
          .set({
            attendanceDate: new Date().toISOString().split('T')[0], // Update date
          })
          .where(and(
            eq(zuvyStudentAttendanceRecords.sessionId, sessionId),
            eq(zuvyStudentAttendanceRecords.userId, userId)
          ));

        // Update status separately using raw SQL
        await db.execute(
          sql`UPDATE zuvy_student_attendance_records 
              SET status = ${status === 'present' ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT}
              WHERE session_id = ${sessionId} AND user_id = ${userId}`
        );
      } else if (status === 'present') {
        // Insert new record only if marking as present
        await db.execute(
          sql`INSERT INTO zuvy_student_attendance_records 
              (session_id, user_id, batch_id, bootcamp_id, attendance_date, status)
              VALUES (${sessionId}, ${userId}, ${session.batchId}, ${bootcampId}, 
                      ${new Date().toISOString().split('T')[0]}, ${AttendanceStatus.PRESENT})`
        );
      }

      // Recompute total attendance count for the user (count only 'present' records)
      const presentCount = await db.select({
        count: sql<number>`cast(count(${zuvyStudentAttendanceRecords.id}) as int)`
      })
        .from(zuvyStudentAttendanceRecords)
        .leftJoin(zuvySessions, eq(zuvyStudentAttendanceRecords.sessionId, zuvySessions.id))
        .where(and(
          eq(zuvyStudentAttendanceRecords.userId, userId),
          eq(zuvySessions.bootcampId, bootcampId),
          eq(zuvyStudentAttendanceRecords.status, AttendanceStatus.PRESENT)
        ));

      const totalAttendance = presentCount[0]?.count || 0;

      // Update the attendance count in batch enrollments
      await db.update(zuvyBatchEnrollments)
        .set({ attendance: totalAttendance })
        .where(and(
          eq(zuvyBatchEnrollments.userId, BigInt(userId)),
          eq(zuvyBatchEnrollments.bootcampId, bootcampId)
        ));

      return {
        status: 'success',
        message: `Attendance marked as ${status} successfully`,
        code: 200,
        data: {
          userId,
          sessionId,
          status,
          totalAttendance,
        },
      };
    } catch (err) {
      return {
        status: 'error',
        message: err.message,
        code: 500,
      };
    }
  }
}
