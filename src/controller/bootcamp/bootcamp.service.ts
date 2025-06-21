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
import { editUserDetailsDto } from './dto/bootcamp.dto'
import { batch } from 'googleapis/build/src/apis/batch';
import { STATUS_CODES } from 'src/helpers';

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

      console.log("Bootcamp data", bootcampTypeData)
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

      const query = db.select({
        userId: users.id,
        name: users.name,
        email: users.email,
        profilePicture: users.profilePicture,
        bootcampId: zuvyBatchEnrollments.bootcampId,
        attendance: zuvyBatchEnrollments.attendance,
        batchName: zuvyBatches.name,
        batchId: zuvyBatches.id,
        progress: zuvyBootcampTracking.progress,
        totalClasses: sql<number>`(
        SELECT COUNT(*) FROM main.zuvy_sessions 
        WHERE main.zuvy_sessions.bootcamp_id = ${zuvyBatchEnrollments.bootcampId}
        AND (${zuvyBatchEnrollments.batchId} IS NULL OR main.zuvy_sessions.batch_id = ${zuvyBatchEnrollments.batchId})
      )`
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
      const modifiedStudentInfo = studentsInfo.map(item => {
        const attendancePercentage =
          item.batchId !== null &&
            item.attendance !== null &&
            item.totalClasses > 0
            ? Math.ceil((item.attendance / item.totalClasses) * 100)
            : 0;

        return {
          ...item,
          userId: Number(item.userId),
          attendance: attendancePercentage,
          batchName: item.batchId != null ? item.batchName : 'unassigned',
          progress: item.progress != null ? item.progress : 0,
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
}
