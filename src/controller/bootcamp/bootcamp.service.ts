import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, count, inArray, or, and } from 'drizzle-orm';
// import { BatchesService } from '../batches/batch.service';
import axios from 'axios';
import * as _ from 'lodash';
import { error, log } from 'console';
import {
  zuvyBootcamps,
  zuvyBatches,
  users,
  zuvyBatchEnrollments,
  zuvySessions,
  zuvyBootcampTracking,
  zuvyBootcampType,
} from '../../../drizzle/schema';

const { ZUVY_CONTENT_URL } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class BootcampService {
  // constructor(private batchesService:BatchesService) { }
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

  async getAllBootcamps(limit: number, offset: number): Promise<any> {
    try {
      let getAllBootcamps = await db
        .select()
        .from(zuvyBootcamps)
        .limit(limit)
        .offset(offset);
        
      const totalCountQuery = await db
        .select({ count: count(zuvyBootcamps.id) })
        .from(zuvyBootcamps);
      let totalPages = Math.ceil(totalCountQuery[0].count / limit);
      let data = await Promise.all(
        getAllBootcamps.map(async (bootcamp) => {
          let [err, res] = await this.enrollData(bootcamp.id);
          if (err) {
            return [err, null];
          }
          return { ...bootcamp, ...res };
        }),
      );
      return [
        null,
        { data, totalBootcamps: totalCountQuery[0].count, totalPages },
      ];
    } catch (e) {
      log(`error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async searchBootcamps(searchTerm: string | number) {
    try {
      let getSearchedBootcamps;
      if (searchTerm.constructor == String) {
        getSearchedBootcamps = await db
          .select()
          .from(zuvyBootcamps)
          .where(
            sql`LOWER(${zuvyBootcamps.name}) LIKE ${searchTerm.toLowerCase()} || '%'`,
          );
      } else {
        getSearchedBootcamps = await db
          .select()
          .from(zuvyBootcamps)
          .where(sql`${zuvyBootcamps.id} = ${searchTerm}`);
      }
      let data = await Promise.all(
        getSearchedBootcamps.map(async (bootcamp) => {
          let [err, res] = await this.enrollData(bootcamp.id);
          if (err) {
            return [err, null];
          }
          return { ...bootcamp, ...res };
        }),
      );
      return [null, data];
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
      let newBootcamp = await db
        .insert(zuvyBootcamps)
        .values(bootcampData)
        .returning();

      const bootcampTypeData = {
        bootcampId: newBootcamp[0].id,
        type: 'Private', // Assuming type is present in bootcampData
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
        return [{ status: 'Error', message: error.message, code: 404 }, null];
      }
      log(`Bootcamp created successfully`);
      return [
        null,
        {
          status: 'success',
          message: 'Bootcamp created successfully',
          code: 200,
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
      const typeOfBootcamp = settingData.type.toLowerCase();
      settingData.type =
        settingData.type.charAt(0).toUpperCase() +
        settingData.type.slice(1).toLowerCase();

      if (
        typeOfBootcamp == 'Public'.toLowerCase() ||
        typeOfBootcamp == 'Private'.toLowerCase()
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

  async addStudentToBootcamp(
    bootcampId: number,
    batchId: number,
    users_data: any,
  ) {
    try {
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
      if (batchId) {
        let batch = await db
          .select()
          .from(zuvyBatches)
          .where(sql`${zuvyBatches.id} = ${batchId}`);
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
        newUser['batch_id'] = batchId;
        newUser['email'] = users_data[i]['email'];
        newUser['name'] = users_data[i]['name'];

        let userInfo = await db
          .select()
          .from(users)
          .where(sql`${users.email} = ${users_data[i]['email']}`);
        if (userInfo.length === 0) {
          userInfo = await db.insert(users).values(newUser).returning();
        } else if (userInfo.length > 0) {
          let userEnrolled = await db
            .select()
            .from(zuvyBatchEnrollments)
            .where(
              sql`${zuvyBatchEnrollments.userId
                } = ${userInfo[0].id.toString()} AND ${zuvyBatchEnrollments.bootcampId
                } = ${bootcampId}`,
            );
          if (userEnrolled.length > 0) {
            let updateEnrol = await db
              .update(zuvyBatchEnrollments)
              .set({ batchId })
              .where(
                sql`${zuvyBatchEnrollments.userId
                  } = ${userInfo[0].id.toString()} AND ${zuvyBatchEnrollments.bootcampId
                  } = ${bootcampId}`,
              )
              .returning();
            if (updateEnrol.length !== 0) {
              userReport.push({
                email: userInfo[0].email,
                message: `Update to the anodher batch`,
              });
              continue;
            }
            continue;
          }
        }
        let enroling = { userId: userInfo[0].id, bootcampId };
        if (batchId) {
          enroling['batchId'] = batchId;
        }
        userReport.push({
          email: userInfo[0].email,
          message: `enrolled successfully`,
        });
        enrollments.push(enroling);
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

      return [
        null,
        {
          status: true,
          code: 200,
          message: `${enrollments.length} students successfully enrolled!`,
          report: report,
          students_enrolled: userReport,
        },
      ];
    } catch (e) {
      log(`error: ${e.message}`);
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  // async getStudentsByBootcampOrBatch(
  //   bootcamp_id,
  //   batch_id,
  //   searchTerm: string | bigint = '',
  //   limit: number,
  //   offset: number,
  // ) {
  //   try {
  //     let queryString;
  //     if (bootcamp_id && batch_id) {
  //       queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} and ${zuvyBatchEnrollments.batchId} = ${batch_id}`;
  //     } else {
  //       queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id}`;
  //     }

  //     const batchesData = await db
  //       .select()
  //       .from(batches)
  //       .where(eq(batches.bootcampId, bootcamp_id));

  //     const batchIds = batchesData.map((obj) => obj.id);

  //     const [count, dataResult] = await Promise.all([
  //       db
  //         .select({ count: sql<number>`count(*)` })
  //         .from(zuvyBatchEnrollments)
  //         .innerJoin(users, eq(zuvyBatchEnrollments.userId, users.id))
  //         .where(
  //           and(
  //             queryString,
  //             searchTerm.constructor === String
  //               ? sql`((LOWER(${users.name}) LIKE ${searchTerm.toLowerCase()} || '%' OR LOWER(${users.email}) LIKE ${searchTerm.toLowerCase()} || '%'))`
  //               : sql`${users.id} = ${searchTerm}`,
  //           ),
  //         )
  //         .execute(),
  //       db
  //         .select({
  //           email: users.email,
  //           name: users.name,
  //           userId: users.id,
  //           bootcampId: zuvyBatchEnrollments.bootcampId,
  //           batchId: zuvyBatchEnrollments.batchId,
  //           attendance: zuvyBatchEnrollments.attendance,
  //           profilePicture: users.profilePicture,
  //         })
  //         .from(zuvyBatchEnrollments)
  //         .innerJoin(users, eq(zuvyBatchEnrollments.userId, users.id))
  //         .where(
  //           and(
  //             queryString,
  //             searchTerm.constructor === String
  //               ? sql`((LOWER(${users.name}) LIKE ${searchTerm.toLowerCase()} || '%' OR LOWER(${users.email}) LIKE ${searchTerm.toLowerCase()} || '%'))`
  //               : sql`${users.id} = ${searchTerm}`,
  //           ),
  //         )
  //         .limit(limit)
  //         .offset(offset)
  //         .execute(),
  //     ]);
  //     const filteredData = dataResult.map((student) => {
  //       return {
  //         ...student,
  //         userId: Number(student.userId),
  //       };
  //     });
  //     let totalStudents = Number(count[0].count);
  //     let totalPages = isNaN(limit) ? 1 : Math.ceil(totalStudents / limit);
  //     for (let student_ of filteredData) {
  //       try {
  //         let total_classes = await db
  //           .select()
  //           .from(classesGoogleMeetLink)
  //           .where(
  //             sql`${classesGoogleMeetLink.batchId} = ${student_.batchId.toString()}`,
  //           );
  //         student_['batchName'] = null;

  //         if (student_.batchId && batchIds.includes(student_.batchId)) {
  //           let batchInfo = await db
  //             .select()
  //             .from(batches)
  //             .where(eq(batches.id, student_.batchId));

  //           if (batchInfo.length > 0) {
  //             student_['batchName'] = batchInfo[0].name;
  //             let student_atte = student_.attendance || 0;
  //             let result = (student_atte / total_classes.length) * 100;
  //             student_['attendance'] = result || 0;
  //             student_['progress'] = 0;
  //           }
  //         }
  //       } catch (error) {
  //         log(`error: ${error.message}`);

  //         return [
  //           { status: 'error', message: 'Fetching emails failed', code: 500 },
  //           null,
  //         ];
  //       }
  //     }
  //     return [
  //       null,
  //       {
  //         status: 'success',
  //         studentsEmails: filteredData,
  //         totalPages,
  //         totalStudents,
  //         code: 200,
  //       },
  //     ];
  //   } catch (e) {
  //     return [{ status: 'error', message: e.message, code: 500 }, null];
  //   }
  // }

  async getStudentsByBootcampOrBatch(
    bootcamp_id,
    batch_id,
    searchTerm: string | bigint = '',
    limit: number,
    offset: number,
  ) {
    let queryString;
    if (bootcamp_id && batch_id) {
      queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} and ${zuvyBatchEnrollments.batchId} = ${batch_id}`;
    } else {
      queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id}`;
    }
    let totalStudentsInTheBatch, studentsIds, studentsInTheBatch;

    if (searchTerm && searchTerm.constructor === String) {
      let studentStringQuery = sql`(${queryString}) AND (LOWER(${users.name}) LIKE ${searchTerm.toLowerCase()} || '%' OR LOWER(${users.email}) LIKE ${searchTerm.toLowerCase()} || '%')`;
      let usersData = await db
        .select({
          id: users.id,
        })
        .from(users)
        .leftJoin(
          zuvyBatchEnrollments,
          sql`${zuvyBatchEnrollments.userId} = ${users.id}`,
        )
        .where(studentStringQuery)
        .limit(limit)
        .offset(offset);

      totalStudentsInTheBatch = await db
        .select({
          id: users.id,
        })
        .from(users)
        .leftJoin(
          zuvyBatchEnrollments,
          sql`${zuvyBatchEnrollments.userId} = ${users.id}`,
        )
        .where(studentStringQuery);

      studentsIds = usersData.map((user) => user.id);
    } else {

      studentsInTheBatch = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(queryString)
        .offset(offset)
        .limit(limit)
        .orderBy(zuvyBatchEnrollments.userId);

      totalStudentsInTheBatch = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(queryString);

      studentsIds = studentsInTheBatch.map((student) => student?.userId);
    }

    if (studentsIds.length === 0) {
      return [{
        "totalStudents": [],
        "totalStudentsCount": 0,
        "code": 200
      }]
    }
    let totalStudents = totalStudentsInTheBatch.length;
    let ed = `${studentsIds.join(', ')}`;
    let mapData = await db.query.zuvyBatchEnrollments.findMany({
      where: (zuvyBatchEnrollments, { sql }) =>
        sql`(${queryString})AND (${zuvyBatchEnrollments.userId} IN (${sql.join(studentsIds, sql`, `)}))`,
      with: {
        userInfo: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        batchInfo: {
          columns: {
            id: true,
            name: true,
          },
        }
      },
    });
    let totalStudentsInfo = await Promise.all(
      mapData.map(async (student: any) => {
        try {
          let studentBatchInfo, batchData;
          if (student?.batchInfo) {
            let classesInfo = await db
              .select()
              .from(zuvySessions)
              .where(sql`${zuvySessions.batchId} = ${student.batchInfo.id}`);

            let attendancePercentage = classesInfo.length > 0 ? (student.attendance / classesInfo.length) * 100 : 0;
            batchData = {
              batchId: student?.batchId ,
              batchName: student.batchInfo?.name ,
              attendance: attendancePercentage,
            }
          } else {
            batchData = {
              batchId: "unassigned",
              batchName: "unassigned",
              attendance: 0,
            }
          }
          studentBatchInfo = {
            email: student?.userInfo.email,
            name: student?.userInfo.name,
            userId: student?.userInfo.id.toString(),
            bootcampId: student.bootcampId,
            profilePicture: student?.userInfo?.profilePicture,
            progress: 0,
            ...batchData
          };
          return studentBatchInfo;

        } catch (error) {
          throw error;
        }
      }),
    );
    return [
      null,
      {
        totalStudents: totalStudentsInfo,
        totalStudentsCount: totalStudents,
        totalPages: Math.ceil(totalStudents / limit),
        code: 200,
      },
    ];
    
  }
  async searchStudentsByNameOrEmail(
    searchTerm: string | bigint,
    bootcampId: number,
  ) {
    try {
      const studentsEmails = [];

      let emailFetched;
      if (searchTerm.constructor === String) {
        emailFetched = await db
          .select()
          .from(users)
          .where(
            sql`LOWER(${users.name}) LIKE ${searchTerm.toLowerCase()} || '%' or LOWER(${users.email}) LIKE ${searchTerm.toLowerCase()} || '%'`,
          );
      } else {
        emailFetched = await db
          .select()
          .from(users)
          .where(sql`${users.id} = ${searchTerm}`);
      }
      for (const user of emailFetched) {
        const student = {
          email: user.email,
          name: user.name,
          userId: user.id.toString(),
          profilePicture: user.profilePicture,
        };

        const zuvyBatchEnrollmentsData = await db
          .select()
          .from(zuvyBatchEnrollments)
          .where(
            sql`${zuvyBatchEnrollments.userId} = ${user.id} and ${zuvyBatchEnrollments.bootcampId} = ${bootcampId}`,
          );

        for (const enrollment of zuvyBatchEnrollmentsData) {
          const studentBatchInfo = {
            ...student,
            bootcampId: enrollment.bootcampId,
            batchId: enrollment.batchId,
            batchName: '',
            progress: 0,
          };

          const batchInfo = await db
            .select()
            .from(zuvyBatches)
            .where(sql`${zuvyBatches.id} = ${enrollment.batchId}`);

          if (batchInfo.length > 0) {
            studentBatchInfo.batchName = batchInfo[0].name;
          }

          const progressInfo = await db
            .select()
            .from(zuvyBootcampTracking)
            .where(
              sql`${zuvyBootcampTracking.userId} = ${user.id} and ${zuvyBootcampTracking.bootcampId} = ${enrollment.bootcampId}`,
            );

          if (progressInfo.length > 0) {
            studentBatchInfo.progress = progressInfo[0].progress;
          }

          studentsEmails.push(studentBatchInfo);
        }
      }

      return [
        {
          status: 'success',
          studentsEmails: studentsEmails,
          code: 200,
        },
      ];
    } catch (error) {

      return [{ status: 'error', message: error.message, code: 500 }, null];
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

  async getStudentClassesByBootcampId(bootcampId, userId) {
    try {
      let zuvyBatchEnrollmentsData = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId} `);
      const matchingEnrollments = zuvyBatchEnrollmentsData.filter(
        (enrollment) => enrollment.userId.toString() === userId.toString(),
      );
      if (matchingEnrollments.length === 0) {
        return {
          status: 'error',
          message:
            'No matching batch enrollments found for the provided bootcampId and userId',
          code: 404,
        };
      }
      const batchId = matchingEnrollments[0].batchId;
      try {
        const currentTime = new Date();

        const classes = await db
          .select()
          .from(zuvySessions)
          .where(sql`${zuvySessions.batchId} = ${batchId}`);
        const completedClasses = classes
          .filter((classObj) => {
            const endTime = new Date(classObj.endTime);
            return currentTime > endTime;
          })
          .sort((a, b) => {
            const aStartTime = new Date(a.startTime);
            const bStartTime = new Date(b.startTime);
            return bStartTime.getTime() - aStartTime.getTime();
          });

        const ongoingClasses = classes.filter((classObj) => {
          const startTime = new Date(classObj.startTime);
          const endTime = new Date(classObj.endTime);
          return currentTime >= startTime && currentTime <= endTime;
        });

        const upcomingClasses = classes.filter((classObj) => {
          const startTime = new Date(classObj.startTime);
          return currentTime < startTime;
        });

        return {
          status: 'success',
          message: 'Classes fetched successfully by batchId',
          code: 200,
          completedClasses,
          ongoingClasses,
          upcomingClasses,
        };
      } catch (error) {
        return {
          success: 'not success',
          message: 'Error fetching class Links',
          error: error,
        };
      }
    } catch (err) {
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }
}