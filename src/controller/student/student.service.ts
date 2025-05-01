import { Injectable, Logger } from '@nestjs/common';
import { error, log } from 'console';
import {
  zuvyBatchEnrollments,
  zuvyBootcamps,
  zuvyBootcampType,
  zuvySessions,
  users,
  zuvyStudentApplicationRecord,
  zuvyBootcampTracking,
  zuvyAssessmentReattempt,
  zuvyAssessmentSubmission
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql, desc, count, asc, or, and, inArray } from 'drizzle-orm';
import { ClassesService } from '../classes/classes.service'
import { helperVariable } from 'src/constants/helper';
import { STATUS_CODES } from "../../helpers/index";
const { PENDING } = helperVariable.REATTMEPT_STATUS; // Importing helper variables

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';


const { GOOGLE_SHEETS_SERVICE_ACCOUNT, GOOGLE_SHEETS_PRIVATE_KEY,JOIN_ZUVY_ACCESS_KEY_ID, JOIN_ZUVY_SECRET_KEY, SPREADSHEET_ID, SES_EMAIL, SUPPORT_EMAIL, QUERY_EMAIL, AWS_QUERY_ACCESS_SECRET_KEY, AWS_QUERY_ACCESS_KEY_ID } = process.env;
const AWS = require('aws-sdk');




@Injectable()
export class StudentService {
  constructor(private ClassesService: ClassesService) { }
  private logger = new Logger(StudentService.name);
  private SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

  // Authenticate and return the JWT client to interact with Google Sheets API
  private async authorize(): Promise<any> {
    const auth = new google.auth.JWT(
      GOOGLE_SHEETS_SERVICE_ACCOUNT,
      null,
      GOOGLE_SHEETS_PRIVATE_KEY,
      this.SCOPES
    );
    return auth; // Returns authorized client for API calls
  }

  // Append student details to Google Spreadsheet
  public async updateSpreadsheet(studentDetails: { name: string, email: string, phoneNo: number, year: string, familyIncomeUnder3Lakhs: boolean }): Promise<any> {
    try {
      // Check if a student with the same email or phone already exists in DB
      const existingRecord = await db
        .select()
        .from(zuvyStudentApplicationRecord)
        .where(
          or(
            eq(zuvyStudentApplicationRecord.email, studentDetails.email),
            eq(zuvyStudentApplicationRecord.phoneNo, studentDetails.phoneNo),
          ),
        )
        .limit(1);
      // If student exists, return a message
      if (existingRecord.length > 0) {
        return [{ message: 'Email or Phone Number already exists.' }];
      }

      // Authorize to interact with Google Sheets
      const auth = await this.authorize();
      const sheets = google.sheets({ version: 'v4', auth });

      // Specify range in the sheet and append the data
      const range = 'Sheet1!A:C';
      const values = [
        [studentDetails.name, studentDetails.email, studentDetails.phoneNo, studentDetails.year, studentDetails.familyIncomeUnder3Lakhs],
      ];
      const resource = { values };

      // Append new data to Google Sheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: 'RAW', // RAW: values entered as-is
        requestBody: resource,
      });

      // Send an email to the student
      await this.sendMail(studentDetails.name, studentDetails.email);

      // Insert student record into the DB
      await db.insert(zuvyStudentApplicationRecord).values(studentDetails).returning();

      return [null, { message: "Thank you for applying! We’re reviewing your application and will notify you soon.", statusCode: STATUS_CODES.OK }];
    } catch (err) {
      // Handle errors and return a bad request message
      return [{ message: err.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  // Generate dynamic email content for the student
  async generateEmailContent(applicantName) {
    return `
    Dear ${applicantName},

    Thank you for applying to ${helperVariable.PROGRAM_DETAILS.NAME}!
    
    We’re excited to see your interest in the amazing Bootcamp for female engineers.
    We have received your application. As the next step, we invite you to complete a short questionnaire that will help us better understand your background and interest in the program.

    **Questionnaire Link**

    **Important Details:**
    - **Deadline:** Please complete the questionnaire ${helperVariable.QUESTIONNAIRE.DEADLINE}. Early submission may benefit your application in the selection process, so we encourage you to complete it as soon as possible.
    - **Questionnaire Duration:** The questionnaire will take ${helperVariable.QUESTIONNAIRE.DURATION} to complete.
    - **Required Documents:** To ensure a smooth evaluation, please have the following documents ready to upload:
      - ${helperVariable.REQUIRED_DOCUMENTS.join('\n        - ')}

    **Note:** Please join our WhatsApp Community for further communication.

    If you encounter any issues with the questionnaire or need assistance, please reach out to us at:
    - **Email:** ${helperVariable.CONTACT_DETAILS.EMAIL}
    - **WhatsApp:** ${helperVariable.CONTACT_DETAILS.WHATSAPP_NUMBER}

    Best regards,
    ${helperVariable.PROGRAM_DETAILS.ORGANIZATION_NAME}
    ${helperVariable.PROGRAM_DETAILS.NAME} - ${helperVariable.PROGRAM_DETAILS.APPLICATION_LINK}

    WhatsApp/Call: ${helperVariable.CONTACT_DETAILS.WHATSAPP_NUMBER} 
  `;
  }

  // Send email using AWS SES
  async sendMail(applicantName, recipientEmail) {
    try {
      // Generate email content dynamically
      AWS.config.update({
        accessKeyId: JOIN_ZUVY_ACCESS_KEY_ID,      // Replace with your access key ID
        secretAccessKey: JOIN_ZUVY_SECRET_KEY, // Replace with your secret access key
        region: 'ap-south-1'                      // Replace with your AWS SES region, e.g., 'us-east-1'
      });
      const emailContent = await this.generateEmailContent(applicantName);
      
      // Create an instance of SES
      const ses = new AWS.SES();

      // Define email parameters for SES
      const emailParams = {
        Source: SES_EMAIL, // This must be a verified email address in SES
        Destination: {
          ToAddresses: [recipientEmail], // Recipient email address
        },
        Message: {
          Subject: {
            Data: `${helperVariable.PROGRAM_DETAILS.NAME} - Application Received`,
          },
          Body: {
            Text: {
              Data: emailContent,
            },
          },
        },
      };
      // Send the email using SES
      const result = await ses.sendEmail(emailParams).promise();
      Logger.log('Email sent successfully:',  JSON.stringify(result));
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async enrollData(userId: number) {
    try {
      let enrolled = await db.query.zuvyBatchEnrollments.findMany({
        where: (zuvyBatchEnrollments, { sql }) => sql`${zuvyBatchEnrollments.userId} = ${userId} AND ${zuvyBatchEnrollments.batchId} IS NOT NULL`,
        columns: {
          id: true
        },
        with: {
          bootcamp: {
            columns: {
              id: true,
              name: true,
              coverImage: true,
              duration: true,
              language: true,
              bootcampTopic: true
            },
          },
          batchInfo: true,
          tracking: {
            where: (bootcampTracking, { sql }) =>
              sql`${bootcampTracking.userId} = ${userId}`,
          }
        }
      })
      let totalData = enrolled.map((e: any) => {
        const { batchInfo, tracking, bootcamp } = e;

        return {
          ...bootcamp,
          batchId: batchInfo?.id,
          batchName: batchInfo?.name,
          progress: tracking?.progress || 0
        };
      });



      return [null, totalData];
    } catch (err) {
      error(`error: ${err.message}`);
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }

  async enrollmentData(bootcampId: number) {
    try {
      let enrolled = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId}`);
      let unEnrolledBatch = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(
          sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NULL`,
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

  async searchPublicBootcampByStudent(searchTerm: string) {
    try {
      let getPubliczuvyBootcamps = await db
        .select()
        .from(zuvyBootcamps)
        .innerJoin(zuvyBootcampType, eq(zuvyBootcamps.id, zuvyBootcampType.bootcampId))
        .where(
          sql`${zuvyBootcampType.type} = 'Public' AND (LOWER(${zuvyBootcamps.name
            }) LIKE ${searchTerm.toLowerCase()} || '%')`,
        );
      let data = await Promise.all(
        getPubliczuvyBootcamps.map(async (bootcamp) => {
          let [err, res] = await this.enrollmentData(bootcamp.zuvy_bootcamp_type.bootcampId);
          if (err) {
            return [err, null];
          }
          return { ...bootcamp, ...res };
        }),
      );
      return [null, data];
    } catch (err) {
      error(`error: ${err.message}`);
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }

  async getPublicBootcamp() {
    try {
      let getPubliczuvyBootcamps = await db
        .select()
        .from(zuvyBootcamps)
        .innerJoin(zuvyBootcampType, eq(zuvyBootcamps.id, zuvyBootcampType.bootcampId))
        .where(
          sql`${zuvyBootcampType.type} = 'Public'`,
        );
      let data = await Promise.all(
        getPubliczuvyBootcamps.map(async (bootcamp) => {
          let [err, res] = await this.enrollmentData(bootcamp.zuvy_bootcamp_type.bootcampId);
          if (err) {
            return [err, null];
          }
          return { ...bootcamp, ...res };
        }),
      );
      return [null, data];
    } catch (err) {
      error(`error: ${err.message}`);
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }

  async removingStudent(user_id: number | number[], bootcamp_id: number) {
    try {
      const userIdsArray = Array.isArray(user_id) ? user_id : [user_id];
  
      let enrolled = await db
        .delete(zuvyBatchEnrollments)
        .where(
          and(
            inArray(zuvyBatchEnrollments.userId,  userIdsArray.map(BigInt)),
            eq(zuvyBatchEnrollments.bootcampId, bootcamp_id)
          )
        )
        .returning();
  
      if (enrolled.length === 0) {
        return [{ status: 'error', message: 'ID not found', code: 404 }, null];
      }
  
      // Delete progress from zuvyBootcampTracking
      let trackingDeleted = await db
        .delete(zuvyBootcampTracking)
        .where(
          and(
            inArray(zuvyBootcampTracking.userId,  userIdsArray.map(Number)),
            eq(zuvyBootcampTracking.bootcampId, Number(bootcamp_id))
          )
        )
        .returning();
  
      const deletedCount = enrolled.length;
  
      return [
        null,
        {
          status: 'true',
          message: deletedCount === 1
            ? 'Student removed from the bootcamp'
            : `${deletedCount} students removed from the bootcamp`,
          code: 200,
        },
      ];
  
    } catch (e) {
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }
  

  async getUpcomingClass(student_id: number, batchID: number, limit: number, offset: number): Promise<any> {
    try {
      let queryString;
      if (batchID) {
        queryString = sql`${zuvyBatchEnrollments.userId} = ${student_id} AND ${zuvyBatchEnrollments.batchId} = ${batchID}`
      } else {
        queryString = sql`${zuvyBatchEnrollments.userId} = ${student_id} AND ${zuvyBatchEnrollments.batchId} IS NOT NULL`
      }
      let enrolled = await db.select().from(zuvyBatchEnrollments).where(queryString);

      if (enrolled.length == 0) {
        return [null, { message: 'not enrolled in any course.', statusCode: STATUS_CODES.OK, data: [] }]
      }
      let bootcampAndbatchIds = await Promise.all(
        enrolled
          .filter(e => e.batchId !== null)
          .map(async e => {
            await this.ClassesService.updatingStatusOfClass(e.bootcampId, e.batchId);
            return { bootcampId: e.bootcampId, batchId: e.batchId };
          })
      );
      let upcomingClasses = await db.query.zuvySessions.findMany({
        where: (session, { and, or, eq, ne }) =>
          and(
            or(...bootcampAndbatchIds.map(({ bootcampId, batchId }) =>
              and(
                eq(session.bootcampId, bootcampId),
                eq(session.batchId, batchId)
              )
            )),
            ne(session.status, helperVariable.completed)
          ),
        orderBy: (session, { asc }) => asc(session.startTime),
        with: {
          bootcampDetail: {
            columns: {
              id: true,
              name: true
            }
          }
        },
        extras: {
          totalCount: sql<number>`coalesce(count(*) over(), 0)`.as('total_count')
        },
        limit,
        offset
      })
      const totalCount = upcomingClasses.length > 0 ? upcomingClasses[0]['totalCount'] : 0;

      const totalClasses = totalCount;
      let filterClasses = upcomingClasses.reduce((acc, e:any) => {
        e['bootcampName'] = e['bootcampDetail'].name;
        e['bootcampId'] = e['bootcampDetail'].id;
        delete e['bootcampDetail'];
        delete e['totalCount']
        if (e.status == helperVariable.upcoming) {
          acc.upcoming.push(e);
        } else {
          acc.ongoing.push(e);
        }
        return acc;
      }, { upcoming: [], ongoing: [] });
      if (Number(totalClasses) == 0) {
        return [null, { message: 'No upcoming classes', statusCode: STATUS_CODES.OK, data: [] }]

      }
      return [null, { message: 'Upcoming classes fetched successfully', statusCode: STATUS_CODES.OK, data: { filterClasses, totalClasses: Number(totalClasses), totalPages: !isNaN(limit) ? Math.ceil(totalClasses / limit) : 1 } }]
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }]
    }
  }

  async getAttendanceClass(student_id: number) {
    try {
      let enrolled = await db.query.zuvyBatchEnrollments.findMany({
        where: (zuvyBatchEnrollments, { sql }) => sql`${zuvyBatchEnrollments.userId} = ${student_id}`,
        with: {
          bootcamp: {
            id: true,
            name: true
          }
        }
      });

      if (enrolled.length == 0) {
        return [{ status: 'error', message: 'not enrolled in any course.', code: 404 }, null];
      }

      let totalAttendance = await Promise.all(enrolled.map(async (e: any) => {
        let classes = await db.select().from(zuvySessions).where(sql`${zuvySessions.batchId} = ${e.batchId} AND ${zuvySessions.status} = 'completed'`).orderBy(desc(zuvySessions.startTime));
        e.attendance = e.attendance != null ? e.attendance : 0;
        e.totalClasses = classes.length;
        e.attendedClasses = classes.length > 0 && e.attendance > 0 ? ((e.attendance / classes.length) * 100).toFixed(2) : 0;
        delete e.userId;
        delete e.bootcamp
        return e;
      }));
      return totalAttendance;
    } catch (err) {
      throw err;
    }
  }

  //This function returns the rank of a particular course based on avg of attendance and course progress
  //The query has a hierarchy from:-
  //zuvyBootcamp->zuvyBatchEnrollments(It has all the students of that particular bootcamp along with attendance)
  //ZuvyBatchEnrollments has a relation with userInfo and bootcamp Tracking table(contains course Progress)
  async getLeaderBoardDetailByBootcamp(bootcampId: number, limit: number, offset: number) {
    try {
      const data = await db.query.zuvyBootcamps.findMany({
        where: (bootcamp, { eq }) => eq(bootcamp.id, bootcampId),
        with: {
          students: {
            columns: { attendance: true },
            where: (batchEnrolled, { sql }) => sql`${batchEnrolled.batchId} IS NOT NULL`,
            with: {
              userInfo: {
                columns: { id: true, name: true, email: true },
              },
              userTracking: {
                columns: { progress: true, updatedAt: true },
                where: (track, { eq }) => eq(track.bootcampId, bootcampId)
              },
            }
          },
        },
      });
      const processedData = data.map(bootcamp => {
        const studentsWithAvg = bootcamp['students'].map(student => {
          if (student['userTracking'] == null) {
            student['userTracking'] = {};
          }
          student['userTracking']['progress'] = student['userTracking']['progress'] != null ? student['userTracking']['progress'] : 0;
          const progress = student['userTracking']['progress'];
          student['userTracking']['updatedAt'] = student['userTracking']['updatedAt'] != null ? student['userTracking']['updatedAt'] : new Date().toISOString();
          const attendance = student['attendance'] != null ? student['attendance'] : 0;
          const averageScore = (attendance + progress) / 2;
          student['attendance'] = attendance;
          return {
            ...student,
            userInfo: {
              id: Number(student.userInfo.id),
              name: student.userInfo.name,
              email: student.userInfo.email,
              averageScore,
            },
          };
        }).sort((a, b) => {
          if (b.userInfo.averageScore === a.userInfo.averageScore) {
            return new Date(a.userTracking['updatedAt']).getTime() - new Date(b.userTracking.updatedAt).getTime();
          }
          return b.userInfo.averageScore - a.userInfo.averageScore;
        });
        const totalStudents = studentsWithAvg.length;
        const totalPages = !isNaN(limit) ? Math.ceil(totalStudents / limit) : 1;
        return {
          ...bootcamp,
          students: !isNaN(limit) && !isNaN(offset) ? studentsWithAvg.slice(offset, limit + offset) : studentsWithAvg,
          totalStudents,
          totalPages
        };
      });
      return processedData;
    }
    catch (err) {
      throw err;
    }
  }
  // Helper method to send email to admin using AWS SES
    private async sendEmailToAdmin(submission: any): Promise<any> {
      try {
        AWS.config.update({
          accessKeyId: AWS_QUERY_ACCESS_KEY_ID,      // Replace with your access key ID
          secretAccessKey: AWS_QUERY_ACCESS_SECRET_KEY, // Replace with your secret access key
          region: 'ap-south-1'                      // Replace with your AWS SES region, e.g., 'us-east-1'
        });
  
        const emailContent = await this.generateAdminEmailContent(submission);
        
        let ses = new AWS.SES({ region: 'ap-south-1' });
        const emailParams = {
          Source: QUERY_EMAIL,
          Destination: {
            ToAddresses: [SUPPORT_EMAIL], // Admin email address
          },
          Message: {
            Subject: {
              Data: 'Re-attempt Request for Assessment Submission',
            },
            Body: {
              Text: {
                Data: emailContent,
              },
            },
          },
        };
  
        const result = await ses.sendEmail(emailParams).promise();
        this.logger.log('Email sent to admin for re-attempt request: ' + JSON.stringify(result));
        return [null, result];
      } catch (error) {
        this.logger.error('Failed to send email to admin', error);
        return [error, null];
      }
    }
   // Generate email content dynamically for admin notification
   private async generateAdminEmailContent(submission: any): Promise<string> {
    return `
Hi Admin,

${submission.name} (${submission.email}) from **${submission.courseName || 'N/A'}** – **${submission.batchName || 'N/A'}** has requested a re‑attempt for the assessment **“${submission.title || 'N/A'}”**.

Request details

• Student ID: ${submission.userId}  
• Course: ${submission.courseName || 'N/A'}  
• Batch: ${submission.batchName || 'N/A'}  
• Assessment: ${submission.title || 'N/A'}  
• Original attempt date: ${submission.startedAt || 'N/A'}  
• Request time: ${new Date().toISOString()}

Next steps
1. Review the request in the Zuvy admin panel.  
2. Approve or decline the re‑attempt.  
3. The student will be notified automatically of your decision.

Need help? Reach out to the Ed‑Ops team on Slack or email [${SUPPORT_EMAIL}](mailto:${SUPPORT_EMAIL}).

Thanks,  
Team Zuvy`;
  }
  

  async requestReattempt(assessmentSubmissionId: number, userId: number): Promise<any> {
    try {
      // Check if submission exists and belongs to user
      const submission:any = await db.query.zuvyAssessmentSubmission.findFirst({
        where: (zuvyAssessmentSubmission, { eq }) =>
          eq(zuvyAssessmentSubmission.id, assessmentSubmissionId),
        with: {
          reattempt: {
            where: (reattempt, { eq }) => eq(reattempt.status, PENDING),
            columns: {
              id: true,
              status: true,
            },
          },
          user:{
            columns:{
              name:true,
              email:true
            }
          },
          submitedOutsourseAssessment:{
            columns: {
              id: true,
              bootcampId: true,
              moduleId: true,
              chapterId: true,
              timeLimit: true,
              marks: true,
              title: true,
              
            },
            with: {
              ModuleAssessment:{
                columns: {
                  id: true,
                  title: true,
                  description: true,
                  marks: true,

                },
              }
            }
          }
        }
      });

      if (!submission) {
        return [{
          status: 'error',
          statusCode: 404,
          message: 'Assessment submission not found',
        }];
      }
      if (submission.reattempt.length > 0) {
        return [{
          status: 'error',
          statusCode: 400,
          message: 'Re-attempt already requested',
        }];
      }
      if (submission.userId !== userId) {
        return [{
          status: 'error',
          statusCode: 403,
          message: 'Unauthorized request',
        }];
      }
      let submitedOutsourseAssessment = submission.submitedOutsourseAssessment
      let ModuleAssessment = submission.submitedOutsourseAssessment.ModuleAssessment
      let user = submission.user

      let batch:any = await db.query.zuvyBatchEnrollments.findFirst({
        where: (zuvyBatchEnrollments, { sql }) =>
          sql`${zuvyBatchEnrollments.userId} = ${userId} AND ${zuvyBatchEnrollments.bootcampId} = ${submitedOutsourseAssessment.bootcampId}`,
        with: {
          batchInfo: {
            columns: {
              name: true,
            },
          },
          bootcamp: {
            columns: {
              name: true,
            },
          },
        },
      });
      // Update submission to mark reattempt requested
      let updateReattmpt:any = { reattemptRequested: true };

      
      await db.update(zuvyAssessmentSubmission)
      .set(updateReattmpt)
      .where(eq(zuvyAssessmentSubmission.id, assessmentSubmissionId));
      let reattemptData:any = { assessmentSubmissionId, userId, requestedAt: new Date(), status: PENDING}
      await db.insert(zuvyAssessmentReattempt).values(reattemptData)
      // Send email to admin notifying reattempt request
      let [errorAdmin, admin200] = await this.sendEmailToAdmin({...submission, ...submitedOutsourseAssessment, ...user, ...ModuleAssessment, batchName: batch.batchInfo.name, courseName: batch.bootcamp.name});
      if (errorAdmin) {
        this.logger.error(`error in sending email to admin: ${errorAdmin}`)
        return [{
          status: 'success',
          statusCode: 200,
          message: 'Re-attempt approved and Not able to notified',
        }];
      }
      return [null,{
        status: 'success',
        statusCode: 200,
        message: 'Re-attempt request sent to admin',
      }];
    } catch (error) {
      this.logger.error('Error in requestReattempt:', error);
      return [{
        status: 'error',
        statusCode: 500,
        message: error,
      }];
    }
  }
}
