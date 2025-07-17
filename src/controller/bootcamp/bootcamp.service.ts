
import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, count, inArray, or, and, like, desc } from 'drizzle-orm';
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
} from '../../../drizzle/schema';
import { editUserDetailsDto } from './dto/bootcamp.dto';
import { STATUS_CODES } from 'src/helpers';
import { google } from 'googleapis';
const { OAuth2 } = google.auth;

const { ZUVY_CONTENT_URL } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class BootcampService {
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

      const data = await Promise.all(
        getBootcamps.map(async (bootcamp) => {
          let [err, res] = await this.enrollData(bootcamp.id);
          if (err) {
            return [err, null];
          }
          return { ...bootcamp, ...res };
        }),
      );

      return [null, { data, totalBootcamps: totalCount, totalPages }];
    } catch (e) {
      log(`error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async getBootcampById(id: number, isContent: boolean): Promise<any> {
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
      if (isContent) {
        try {
          let respo = await axios.get(
            ZUVY_CONTENT_URL +
            `/${id}?populate=zuvy_modules&populate=zuvy_modules.zuvy_articles&populate=zuvy_modules.zuvy_mcqs.quiz.qz`,
          );
          bootcamp[0]['content'] = respo.data;
        } catch (error) {
          log(`Error posting data: ${error.message}`);
        }
      }

      return [
        null,
        {
          status: 'success',
          message: 'Bootcamp fetched successfully',
          code: 200,
          bootcamp: { ...bootcamp[0], ...res },
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

  async updateBootcampSetting(bootcamp_id: number, settingData) {
    try {
      const typeOfBootcamp = settingData.type ? settingData.type.toLowerCase() : null;
      if (settingData.type) {
        settingData.type =
          settingData.type.charAt(0).toUpperCase() +
          settingData.type.slice(1).toLowerCase();
      }

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
          },
        ];
      } else {
        return [
          null,
          {
            status: 'success',
            message: `Course type can be of type Public or Private`,
            code: 200,
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
      await db.delete(zuvyBatches).where(eq(zuvyBatches.bootcampId, id));
      await db
        .delete(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.bootcampId, id));
      let data = await db
        .delete(zuvyBootcamps)
        .where(eq(zuvyBootcamps.id, id))
        .returning();
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
    limit: number,
    offset: number,
  ): Promise<any> {
    try {
      const batchesData = await db
        .select()
        .from(zuvyBatches)
        .where(eq(zuvyBatches.bootcampId, bootcamp_id))
        .limit(limit)
        .offset(offset);

      const totalCountQuery = await db
        .select({ count: count(zuvyBatches.id) })
        .from(zuvyBatches)
        .where(eq(zuvyBatches.bootcampId, bootcamp_id));
      let totalPages;
      totalPages = Math.ceil(totalCountQuery[0].count / limit);

      const promises = batchesData.map(async (batch) => {
        const userEnrolled = await db
          .select()
          .from(zuvyBatchEnrollments)
          .where(
            sql`${zuvyBatchEnrollments.batchId} = ${batch.id} and ${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id}`,
          );
        batch['students_enrolled'] = userEnrolled.length;
        return batch; // return the modified batch
      });
      const data = await Promise.all(promises);
      return [
        null,
        { data, totalBatches: totalCountQuery[0].count, totalPages },
      ];
    } catch (e) {
      return { status: 'error', message: e.message, code: 500 };
    }
  }

  async searchBatchByIdBootcamp(
    bootcamp_id: number,
    searchTerm: string,
  ): Promise<any> {
    try {
      const batchesData = await db
        .select()
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
        return batch; // return the modified batch
      });
      const batchesWithEnrollment = await Promise.all(promises);
      return [null, batchesWithEnrollment];
    } catch (e) {
      return { status: 'error', message: e.message, code: 500 };
    }
  }

  /**
   * Fetch all attendance for a bootcamp, grouping by meetingId.
   * If a meetingId appears only once, store in 'unique';
   * if it appears more than once, store all records in 'duplicates'.
   */
  async getGroupedAttendanceByBootcamp(bootcampId: number) {
    try {
      // 1. Fetch all attendance records for the bootcamp
      const attendanceRecords = await db
        .select()
        .from(zuvyStudentAttendance)
        .where(eq(zuvyStudentAttendance.bootcampId, bootcampId));

      // 2. Group by meetingId
      const groupedByMeetingId = _.groupBy(attendanceRecords, 'meetingId');

      const uniqueAttendances = [];
      const duplicateAnalysis = [];
      const logger = new Logger(BootcampService.name);
      const idsToDelete: number[] = [];

      // 3. Merge duplicates and collect ids to delete
      for (const meetingId in groupedByMeetingId) {
        const records = groupedByMeetingId[meetingId];
        if (records.length === 1) {
          uniqueAttendances.push(records[0]);
        } else {
          // Merge duplicates
          const mainRecord = _.cloneDeep(records[0]);
          const originalStudents = Array.isArray(mainRecord.attendance) ? [...mainRecord.attendance] : [];
          const newlyAddedStudents = [];
          const mainRecordStudentEmails = new Set(originalStudents.map((a: any) => a.email));
          for (let i = 1; i < records.length; i++) {
            const duplicateRecord = records[i];
            if (duplicateRecord.attendance && Array.isArray(duplicateRecord.attendance)) {
              (duplicateRecord.attendance as any[]).forEach(student => {
                if (student.email && !mainRecordStudentEmails.has(student.email)) {
                  (mainRecord.attendance as any[]).push(student);
                  mainRecordStudentEmails.add(student.email);
                  newlyAddedStudents.push(student);
                }
              });
            }
            idsToDelete.push(duplicateRecord.id); // Mark for deletion
          }
          uniqueAttendances.push(mainRecord);
          duplicateAnalysis.push({
            meetingId: meetingId,
            originalStudents: originalStudents,
            newlyAddedStudents: newlyAddedStudents,
            originalStudentCount: originalStudents.length,
            newlyAddedStudentsCount: newlyAddedStudents.length,
            finalStudentCount: (mainRecord.attendance as any[]).length,
          });
        }
      }

      // 4. Delete duplicate records
      if (idsToDelete.length > 0) {
        await db.delete(zuvyStudentAttendance).where(inArray(zuvyStudentAttendance.id, idsToDelete));
      }

      // 5. Update merged records in DB (optional, if you want to update the merged attendance)
      //    This step is only needed if you want to update the main record with the merged attendance array
      //    Uncomment if needed:
      for (const record of uniqueAttendances) {
        await db.update(zuvyStudentAttendance)
          .set({ attendance: record.attendance })
          .where(eq(zuvyStudentAttendance.id, record.id));
      }

      // 6. Reset all attendance counts for this bootcamp
      await db.update(zuvyBatchEnrollments)
        .set({ attendance: 0 })
        .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId));

      // 7. Count attendance per student (by email)
      const attendanceCountByEmail: Record<string, number> = {};
      for (const record of uniqueAttendances) {
        if (Array.isArray(record.attendance)) {
          for (const student of record.attendance) {
            if (student.email && student.attendance === 'present') {
              const email = student.email.trim().toLowerCase();
              attendanceCountByEmail[email] = (attendanceCountByEmail[email] || 0) + 1;
            }
          }
        }
      }

      // 8. Update zuvyBatchEnrollments.attendance for each student
      for (const email in attendanceCountByEmail) {
        // Find user id by email
        const userRecords = await db.select({ id: users.id })
          .from(users)
          .where(eq(users.email, email));
        if (!userRecords.length) continue; // skip if user not found
        const userId = userRecords[0].id;
        await db.update(zuvyBatchEnrollments)
          .set({ attendance: attendanceCountByEmail[email] })
          .where(and(
            eq(zuvyBatchEnrollments.userId, userId),
            eq(zuvyBatchEnrollments.bootcampId, bootcampId)
          ));
      }

      return {
        status: 'success',
        data: {
          allAttendances: uniqueAttendances,
          mergeAnalysis: duplicateAnalysis,
          totalMeetings: uniqueAttendances.length,
          mergedMeetingCount: duplicateAnalysis.length,
          attendanceCountByEmail,
        },
      };
    } catch (error) {
      const logger = new Logger(BootcampService.name);
      logger.error(`Error fetching grouped attendance: ${error.message}`);
      return {
        status: 'error',
        message: 'Could not fetch grouped attendance data.',
      };
    }
  }

  async addStudentToBootcamp(
    bootcampId: number,
    batchId: number,
    users_data: any[],
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
            enroling = { userId: userInfo[0].id, bootcampId };
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

      return [
        null,
        {
          status: 'success',
          code: 200,
          message: message,
          students_enrolled: userReport,
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
  ) {
    try {
      // Fetch all sessions for the batch in the bootcamp (only completed)
      const sessions = await db.select().from(zuvySessions)
        .where(and(
          eq(zuvySessions.bootcampId, bootcampId),
          batchId ? eq(zuvySessions.batchId, batchId) : undefined,
          eq(zuvySessions.status, 'completed')
        ));
      const sessionMeetingIds = sessions.map(s => s.meetingId);
      // Fetch all student attendance records for these sessions
      const allAttendanceRecords = sessionMeetingIds.length > 0
        ? await db.select().from(zuvyStudentAttendance)
            .where(inArray(zuvyStudentAttendance.meetingId, sessionMeetingIds))
        : [];
      // Fetch students in the batch
      const query = db.select({
        userId: users.id,
        name: users.name,
        email: users.email,
        profilePicture: users.profilePicture,
        bootcampId: zuvyBatchEnrollments.bootcampId,
        batchName: zuvyBatches.name,
        batchId: zuvyBatches.id,
        progress: zuvyBootcampTracking.progress,
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
          batchId ? eq(zuvyBatchEnrollments.batchId, batchId) : undefined,
          searchTerm && searchTerm.constructor === String ? sql`(LOWER(${users.name}) LIKE ${searchTerm.toLowerCase()} || '%' OR LOWER(${users.email}) LIKE ${searchTerm.toLowerCase()} || '%')` : undefined
        ))
        .orderBy(users.name);
      const mapData = await query;
      const totalNumberOfStudents = mapData.length;
      const studentsInfo = !isNaN(limit) && !isNaN(offset) ? mapData.slice(offset, offset + limit) : mapData;
      // Build a map of meetingId to the zuvyStudentAttendance record with the highest id
      const attendanceMap: Record<string, any> = {};
      for (const record of allAttendanceRecords) {
        if (!attendanceMap[record.meetingId] || record.id > attendanceMap[record.meetingId].id) {
          attendanceMap[record.meetingId] = record;
        }
      }
      const modifiedStudentInfo = studentsInfo.map((item, idx) => {
        // Only consider sessions for the student's batch
        const studentSessions = sessions.filter(s => s.batchId === item.batchId);
        const totalClasses = studentSessions.length;
        let attended = 0;
        let debugLogs: any[] = [];
        if (item.batchId != null && totalClasses > 0) {
          // For each session, check if student was present
          for (const session of studentSessions) {
            const attendanceRecord = attendanceMap[session.meetingId];
            if (attendanceRecord && Array.isArray(attendanceRecord.attendance)) {
              const studentAttendance = attendanceRecord.attendance.find((a: any) => a.email === item.email);
              if (studentAttendance && studentAttendance.attendance === 'present') attended++;
              
            }
          }
        }
        let attendancePercentage = 0;
        if (item.batchId != null && totalClasses > 0) {
          const percent = (attended / totalClasses) * 100;
          const decimal = percent - Math.floor(percent);
          attendancePercentage = decimal < 0.5 ? Math.floor(percent) : Math.ceil(percent);
        }
        return {
          ...item,
          userId: Number(item.userId),
          attendance: attendancePercentage,
          batchName: item.batchId != null ? item.batchName : 'unassigned',
          progress: item.progress != null ? item.progress : 0,
          totalClasses: String(totalClasses),
        };
      });
      const currentPage = !isNaN(limit) && !isNaN(offset) ? offset / limit + 1 : 1;
      const totalPages = !isNaN(limit) ? Math.ceil(totalNumberOfStudents / limit) : 1;
      return {
        status: 'success',
        code: 200,
        modifiedStudentInfo,
        totalNumberOfStudents,
        currentPage,
        totalPages
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
      // Validate user existence in the users table
      const userExists = await db
        .select({ id: users.id })
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
      const updateData: { name?: string; email?: string } = {};

      if (editUserDetailsDto.name) {
        updateData.name = editUserDetailsDto.name;
      }
      if (editUserDetailsDto.email) {
        updateData.email = editUserDetailsDto.email;
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
  async processAttendanceRecords(bootcampId: number) {
    try {
      const logger = new Logger('BootcampService');
      let totalSessionsProcessed = 0;
      let totalSessionsWithAttendance = 0;
      let totalPresentStudents = 0;
      let totalEnrollmentsUpdated = 0;

      // Step 1: Fetch all batches for the bootcamp
      const batches = await db.select().from(zuvyBatches).where(eq(zuvyBatches.bootcampId, bootcampId));
      // Step 2: Reset all attendance counts
      await db.update(zuvyBatchEnrollments)
        .set({ attendance: 0 })
        .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId));


      for (const batch of batches) {
        // Map to store attendance count per userId (batch-scoped)
        const attendanceMap = new Map<number, number>();

        // Step 3: Fetch all sessions for this batch
        const sessions = await db.select().from(zuvySessions)
          .where(and(
            eq(zuvySessions.bootcampId, bootcampId),
            eq(zuvySessions.batchId, batch.id),
            eq(zuvySessions.status, 'completed')
          ));
        totalSessionsProcessed += sessions.length;

        // Step 4: Fetch all students enrolled in this batch
        const enrollments = await db.select().from(zuvyBatchEnrollments)
          .where(and(
            eq(zuvyBatchEnrollments.bootcampId, bootcampId),
            eq(zuvyBatchEnrollments.batchId, batch.id)
          ));

        // Step 5: For each session, fetch and update attendance
        for (const session of sessions) {
          // Remove old attendance record if exists
          await db.delete(zuvyStudentAttendance).where(eq(zuvyStudentAttendance.meetingId, session.meetingId));

          // Fetch attendance from Google API (call helper)
          let attendanceData: any[] = [];
          try {
            attendanceData = await this.getAttendanceForSession(session, enrollments);
          } catch (err) {
            logger.error(`Error fetching attendance for session ${session.meetingId}: ${err.message}`);
          }

          // Insert new attendance record
          await db.insert(zuvyStudentAttendance).values({
            attendance: attendanceData,
            meetingId: session.meetingId,
            batchId: batch.id,
            bootcampId: bootcampId
          });

          // Count attendance for each student
          let sessionHasAttendance = false;
          for (const student of attendanceData) {
            if (!student.email?.trim() || student.attendance !== 'present') continue;
            sessionHasAttendance = true;
            totalPresentStudents++;
            const userRecords = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.email, student.email.trim().toLowerCase()));
            if (!userRecords.length) continue;
            const userId = Number(userRecords[0].id);
            attendanceMap.set(userId, (attendanceMap.get(userId) || 0) + 1);
          }
          if (sessionHasAttendance) totalSessionsWithAttendance++;
        }

        // Step 6: Update zuvyBatchEnrollments for each student in this batch
        for (const enrollment of enrollments) {
          const attended = attendanceMap.get(Number(enrollment.userId)) || 0;
          await db.update(zuvyBatchEnrollments)
            .set({ attendance: attended })
            .where(eq(zuvyBatchEnrollments.id, enrollment.id));
          totalEnrollmentsUpdated++;
        }
      }

      return [null, {
        totalSessionsProcessed,
        totalSessionsWithAttendance,
        totalPresentStudents,
        totalEnrollmentsUpdated,
        message: 'Attendance processing completed successfully (with Google API logic stubbed)'
      }];
    } catch (err) {
      return [err, null];
    }
  }
  /**
   * Fetch attendance for a single session using Google API (reports_v1 + JWT)
   * @param session Session object
   * @param enrollments Enrollments for the batch
   */
  async getAttendanceForSession(session: any, enrollments: any[]): Promise<any[]> {
    const logger = new Logger('BootcampService');
    try {
      // 1. Get session creator's tokens
      const userData = await db.select().from(users).where(eq(users.email, session.creator));
      if (!userData.length) {
        logger.warn(`[Attendance] No user found for session creator: ${session.creator}`);
        return [];
      }
      const tokens = await db
        .select()
        .from(require('../../../drizzle/schema').userTokens)
        .where(eq(require('../../../drizzle/schema').userTokens.userId, Number(userData[0].id)));
      if (!tokens.length) {
        logger.warn(`[Attendance] No tokens found for user: ${session.creator}`);
        return [];
      }

      // 2. Set up OAuth2 client
      const auth2Client = new OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_SECRET,
        process.env.GOOGLE_REDIRECT
      );
      auth2Client.setCredentials({
        access_token: tokens[0].accessToken,
        refresh_token: tokens[0].refreshToken,
      });
      const client = google.admin({ version: 'reports_v1', auth: auth2Client });

      // 3. Fetch Google Meet activity logs for this session
      const response = await client.activities.list({
        userKey: 'all',
        applicationName: 'meet',
        eventName: 'call_ended',
        maxResults: 1000,
        filters: `calendar_event_id==${session.meetingId}`,
      });
      const items = response.data.items || [];
      if (!items.length) {
        logger.warn(`[Attendance] No activity logs found for meetingId: ${session.meetingId}`);
        return [];
      }

      // 4. Extract host email
      const organizerParam = items[0]?.events?.[0]?.parameters?.find((p: any) => p.name === 'organizer_email');
      const hostEmail = organizerParam?.value;
      if (!hostEmail) {
        logger.warn(`[Attendance] No host email found for meetingId: ${session.meetingId}`);
        return [];
      }

      // 5. Create JWT client as host
      const { PRIVATE_KEY, CLIENT_EMAIL } = process.env;
      if (!PRIVATE_KEY || !CLIENT_EMAIL) {
        logger.error('[Attendance] Missing PRIVATE_KEY or CLIENT_EMAIL in environment');
        return [];
      }
      const formattedPrivateKey = PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
      const jwtClient = new google.auth.JWT({
        email: CLIENT_EMAIL,
        key: formattedPrivateKey,
        scopes: [
          'https://www.googleapis.com/auth/drive.metadata.readonly',
          'https://www.googleapis.com/auth/calendar.events.readonly',
        ],
        subject: hostEmail,
      });
      await jwtClient.authorize();

      // 6. Get event attachments (find video/mp4)
      const calendar = google.calendar({ version: 'v3', auth: jwtClient });
      const { data: event } = await calendar.events.get({
        calendarId: 'primary',
        eventId: session.meetingId,
        fields: 'attachments(fileId,mimeType,fileUrl)',
      });
      const videoAttach = event.attachments?.find((a: any) => a.mimeType === 'video/mp4');
      let totalSeconds = 0;
      if (videoAttach) {
        const drive = google.drive({ version: 'v3', auth: jwtClient });
        const { data: fileMeta } = await drive.files.get({
          fileId: videoAttach.fileId,
          fields: 'videoMediaMetadata(durationMillis)',
        });
        const durationMillis = Number(fileMeta.videoMediaMetadata?.durationMillis) || 0;
        totalSeconds = durationMillis / 1000;
      }
      if (!totalSeconds) {
        logger.warn(`[Attendance] No recording duration found for meetingId: ${session.meetingId}`);
        return [];
      }

      // 7. Calculate attendance for each student (avoid N+1 queries)
      const userIds = enrollments.map(e => BigInt(e.userId));
      const userRecords = userIds.length
        ? await db.select().from(users).where(inArray(users.id, userIds))
        : [];
      const emailMap: Record<string, string> = {};
      userRecords.forEach(u => {
        emailMap[String(u.id)] = u.email;
      });
      const cutoff = totalSeconds * 0.75;
      const attendance: Record<string, { email: string; duration: number; attendance: string }> = {};
      for (const enrollment of enrollments) {
        const email = emailMap[String(enrollment.userId)];
        if (email) {
          attendance[email] = {
            email,
            duration: 0,
            attendance: 'absent',
          };
        }
      }
      response.data.items?.forEach((item: any) => {
        const e = item.events[0];
        const email = e.parameters.find((p: any) => p.name === 'identifier')?.value;
        const secs = e.parameters.find((p: any) => p.name === 'duration_seconds')?.intValue || 0;
        if (email && attendance[email]) {
          attendance[email].duration += Number(secs);
        }
      });
      for (const rec of Object.values(attendance)) {
        rec.attendance = rec.duration >= cutoff ? 'present' : 'absent';
      }
      return Object.values(attendance);
    } catch (error) {
      const logger = new Logger('BootcampService');
      logger.error(`[Attendance] Error in getAttendanceForSession: ${error.message}`);
      return [];
    }
  }
}
