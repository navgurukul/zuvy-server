import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql ,count} from 'drizzle-orm';
// import { BatchesService } from '../batches/batch.service';
import axios from 'axios';
import * as _ from 'lodash';
import { error, log } from 'console';
import {
  bootcamps,
  batches,
  users,
  batchEnrollments,
  classesGoogleMeetLink,
  bootcampTracking,
} from '../../../drizzle/schema';

const { ZUVY_CONTENT_URL } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class BootcampService {
  // constructor(private batchesService:BatchesService) { }
  async enrollData(bootcampId: number) {
    try {
      let enrolled = await db
        .select()
        .from(batchEnrollments)
        .where(sql`${batchEnrollments.bootcampId} = ${bootcampId}`);
      let unEnrolledBatch = await db
        .select()
        .from(batchEnrollments)
        .where(
          sql`${batchEnrollments.bootcampId} = ${bootcampId} AND ${batchEnrollments.batchId} IS NULL`,
        );
      return [
        null,
        {
          students_in_bootcamp: enrolled.length,
          unassigned_students: unEnrolledBatch.length,
        },
      ];
    } catch (error) {
      log(`error: ${error.message}`);
      return [{ status: 'error', message: error.message, code: 500 }, null];
    }
  }

  async getAllBootcamps(): Promise<any> {
    try {
      let getAllBootcamps = await db.select().from(bootcamps);

      let data = await Promise.all(
        getAllBootcamps.map(async (bootcamp) => {
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
        .from(bootcamps)
        .where(sql`${bootcamps.id} = ${id}`);
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
        .insert(bootcamps)
        .values(bootcampData)
        .returning();
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
        .update(bootcamps)
        .set({ ...bootcampData })
        .where(eq(bootcamps.id, id))
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

  async deleteBootcamp(id: number): Promise<any> {
    try {
      await db.delete(batches).where(eq(batches.bootcampId, id));
      await db
        .delete(batchEnrollments)
        .where(eq(batchEnrollments.bootcampId, id));
      let data = await db
        .delete(bootcamps)
        .where(eq(bootcamps.id, id))
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

  async getBatchByIdBootcamp(bootcamp_id: number): Promise<any> {
    try {
      const batchesData = await db
        .select()
        .from(batches)
        .where(eq(batches.bootcampId, bootcamp_id));
      const promises = batchesData.map(async (batch) => {
        const userEnrolled = await db
          .select()
          .from(batchEnrollments)
          .where(sql`${batchEnrollments.batchId} = ${batch.id}`);
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
        .from(bootcamps)
        .where(sql`${bootcamps.id} = ${bootcampId}`);
      if (bootcampData.length === 0) {
        return [
          { status: 'error', message: 'Bootcamp not found', code: 404 },
          null,
        ];
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
            .from(batchEnrollments)
            .where(
              sql`${
                batchEnrollments.userId
              } = ${userInfo[0].id.toString()} AND ${
                batchEnrollments.bootcampId
              } = ${bootcampId}`,
            );
          if (userEnrolled.length > 0) {
            let updateEnrol = await db
              .update(batchEnrollments)
              .set({ batchId })
              .where(
                sql`${
                  batchEnrollments.userId
                } = ${userInfo[0].id.toString()} AND ${
                  batchEnrollments.bootcampId
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
          .insert(batchEnrollments)
          .values(enrollments)
          .returning();
        if (students_enrolled.length === 0) {
          return [
            { status: 'error', message: 'Error enrolling students', code: 500 },
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

  async getStudentsByBootcampOrBatch(bootcamp_id, batch_id, limit:number, offset: number) {
    try {
      let queryString;
      if (bootcamp_id && batch_id) {
        queryString = sql`${batchEnrollments.bootcampId} = ${bootcamp_id} and ${batchEnrollments.batchId} = ${batch_id}`;
      } else {
        queryString = sql`${batchEnrollments.bootcampId} = ${bootcamp_id}`;
      }

       const totalStudents = await db
         .select({count : count(batchEnrollments.bootcampId)})
         .from(batchEnrollments)
         .where(queryString);

        let totalPages = Math.ceil(totalStudents[0].count/ limit);
      let batchEnrollmentsData = await db
        .select()
        .from(batchEnrollments)
        .where(queryString)
        .limit(limit)
        .offset(offset);
      console.log(batchEnrollmentsData);
      
      const studentsEmails = [];
      for (const studentEmail of batchEnrollmentsData) {
        try {
          let student = {};
          const emailFetched = await db
            .select()
            .from(users)
            .where(eq(users.id, studentEmail.userId));
          if (emailFetched && emailFetched.length > 0) {
            student = {
              email: emailFetched[0].email,
              name: emailFetched[0].name,
              userId: emailFetched[0].id.toString(),
              bootcampId: studentEmail.bootcampId,
              profilePicture: emailFetched[0].profilePicture,
            };
            let batchInfo;
            let progressInfo;
            if (studentEmail.batchId) {
              batchInfo = await db
                .select()
                .from(batches)
                .where(eq(batches.id, studentEmail.batchId));
              if (batchInfo.length > 0) {
                student['batchName'] = batchInfo[0].name;
                student['batchId'] = batchInfo[0].id;
              }
            }
            progressInfo = await db
              .select()
              .from(bootcampTracking)
              .where(
                sql`${bootcampTracking.userId}= ${studentEmail.userId} and ${bootcampTracking.bootcampId} = ${studentEmail.bootcampId}`,
              );
            if (progressInfo.length > 0) {
              student['progress'] = progressInfo[0].progress;
            } else {
              student['progress'] = 0;
            }
          }
          if (emailFetched && emailFetched.length > 0) {
            studentsEmails.push(student);
          }
        } catch (error) {
          log(`error: ${error.message}`);

          return [
            { status: 'error', message: 'Fetching emails failed', code: 500 },
            null,
          ];
        }
      }
      return [
        null,
        { status: 'success', studentsEmails: studentsEmails,totalPages,totalStudents: totalStudents[0].count, code: 200 },
      ];
    } catch (e) {
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }
  
  async searchStudentsByNameOrEmail(searchTerm: string,bootcampId: number) {
  try {
    const studentsEmails = [];
    console.log("inside service")

  
   const  emailFetched = await db
      .select()
      .from(users)
      .where(
        sql`LOWER(${users.name}) LIKE ${searchTerm.toLowerCase()} || '%' or LOWER(${users.email}) LIKE ${searchTerm.toLowerCase()} || '%'` 
      );
      
    //console.log(emailFetched);
    for (const user of emailFetched) {
      const student = {
        email: user.email,
        name: user.name,
        userId: user.id.toString(),
        profilePicture: user.profilePicture,
      };

      const batchEnrollmentsData = await db
        .select()
        .from(batchEnrollments)
        .where(sql`${batchEnrollments.userId} = ${user.id} and ${batchEnrollments.bootcampId} = ${bootcampId}`);

      for (const enrollment of batchEnrollmentsData) {
        const studentBatchInfo = {
          ...student,
          bootcampId: enrollment.bootcampId,
          batchId: enrollment.batchId,
          batchName: '',
          progress: 0,
        };

        const batchInfo = await db
          .select()
          .from(batches)
          .where(sql`${batches.id} = ${enrollment.batchId}`);

        if (batchInfo.length > 0) {
          studentBatchInfo.batchName = batchInfo[0].name;
        }

        const progressInfo = await db
          .select()
          .from(bootcampTracking)
          .where(
            sql`${bootcampTracking.userId} = ${user.id} and ${bootcampTracking.bootcampId} = ${enrollment.bootcampId}`,
          );

        if (progressInfo.length > 0) {
          studentBatchInfo.progress = progressInfo[0].progress;
        }

        studentsEmails.push(studentBatchInfo);
      }
    }

    return [
      null,
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
        .from(bootcamps)
        .where(sql`${bootcamps.id} = ${bootcampId}`);
      if (bootcampData.length === 0) {
        return [
          { status: 'error', message: 'Bootcamp not found', code: 404 },
          null,
        ];
      }
      let progressInfo = await db
        .select()
        .from(bootcampTracking)
        .where(
          sql`${bootcampTracking.userId}= ${userId} and ${bootcampTracking.bootcampId} = ${bootcampId}`,
        );
      let batchInfo = await db
        .select()
        .from(batchEnrollments)
        .where(
          sql`${batchEnrollments.userId}= ${userId} and ${batchEnrollments.bootcampId} = ${bootcampId}`,
        );

      if (batchInfo.length > 0) {
        let batch = await db
          .select()
          .from(batches)
          .where(sql`${batches.id} = ${batchInfo[0].batchId}`);
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
      console.log(bootcampId, userId);
      let batchEnrollmentsData = await db
        .select()
        .from(batchEnrollments)
        .where(sql`${batchEnrollments.bootcampId} = ${bootcampId} `);
      console.log(batchEnrollmentsData);

      const matchingEnrollments = batchEnrollmentsData.filter(
        (enrollment) => enrollment.userId.toString() === userId.toString(),
      );
      console.log(matchingEnrollments);
      if (matchingEnrollments.length === 0) {
        return {
          status: 'error',
          message:
            'No matching batch enrollments found for the provided bootcampId and userId',
          code: 404,
        };
      }
      const batchId = matchingEnrollments[0].batchId;
      console.log(batchId);
      try {
        const currentTime = new Date();

        const classes = await db
          .select()
          .from(classesGoogleMeetLink)
          .where(sql`${classesGoogleMeetLink.batchId} = ${batchId}`);

        const completedClasses = [];
        const ongoingClasses = [];
        const upcomingClasses = [];

        for (const classObj of classes) {
          const startTime = new Date(classObj.startTime);
          const endTime = new Date(classObj.endTime);

          if (currentTime > endTime) {
            completedClasses.push(classObj);
          } else if (currentTime >= startTime && currentTime <= endTime) {
            ongoingClasses.push(classObj);
          } else {
            upcomingClasses.push(classObj);
          }
        }

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
