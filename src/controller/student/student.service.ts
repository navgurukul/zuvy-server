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
  zuvyAssessmentSubmission,
  zuvyOutsourseAssessments,
  zuvyModuleAssessment,
  zuvyBatches,
  zuvyModuleChapter,
  zuvyCourseModules,
  zuvyModuleTopics,
  zuvyAssignmentSubmission,
  zuvyOrganizations,
  zuvyMentorSlotBooking,
  zuvyMentorSlotAvailability,
  zuvyChapterTracking,
  zuvyProjectTracking,
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import {
  eq,
  sql,
  desc,
  count,
  asc,
  or,
  and,
  inArray,
  isNull,
  isNotNull,
  gte,
  lte,
} from 'drizzle-orm';
import { ClassesService } from '../classes/classes.service';
import { AttendanceCalculationService } from 'src/services/attendance/attendance-calculation.service';
import { helperVariable } from 'src/constants/helper';
import { STATUS_CODES } from '../../helpers/index';
const { PENDING } = helperVariable.REATTMEPT_STATUS; // Importing helper variables

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { IoTJobsDataPlane } from 'aws-sdk';

const {
  GOOGLE_SHEETS_SERVICE_ACCOUNT,
  GOOGLE_SHEETS_PRIVATE_KEY,
  JOIN_ZUVY_ACCESS_KEY_ID,
  JOIN_ZUVY_SECRET_KEY,
  SPREADSHEET_ID,
  SES_EMAIL,
  SUPPORT_EMAIL,
  QUERY_EMAIL,
  AWS_QUERY_ACCESS_SECRET_KEY,
  AWS_QUERY_ACCESS_KEY_ID,
} = process.env;
const AWS = require('aws-sdk');

// Add interfaces for event types
interface BaseEvent {
  type: 'class' | 'assessment';
  id: number;
  title: string;
  bootcampId: number;
  bootcampName: string;
}

interface ClassEvent extends BaseEvent {
  type: 'class';
  startTime: string;
  endTime: string;
  status: string;
  batchId: number;
}

interface AssessmentEvent extends BaseEvent {
  type: 'assessment';
  dueDate: string;
  timeLimit: number;
  marks: number;
  startDatetime: string;
  endDatetime: string;
}

type Event = ClassEvent | AssessmentEvent;

@Injectable()
export class StudentService {
  constructor(
    private ClassesService: ClassesService,
    private readonly attendanceCalc: AttendanceCalculationService,
  ) {}
  private logger = new Logger(StudentService.name);
  private SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

  // Authenticate and return the JWT client to interact with Google Sheets API
  private async authorize(): Promise<any> {
    const auth = new google.auth.JWT(
      GOOGLE_SHEETS_SERVICE_ACCOUNT,
      null,
      GOOGLE_SHEETS_PRIVATE_KEY,
      this.SCOPES,
    );
    return auth; // Returns authorized client for API calls
  }

  // Append student details to Google Spreadsheet
  public async updateSpreadsheet(studentDetails: {
    name: string;
    email: string;
    phoneNo: number;
    year: string;
    familyIncomeUnder3Lakhs: boolean;
  }): Promise<any> {
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
        [
          studentDetails.name,
          studentDetails.email,
          studentDetails.phoneNo,
          studentDetails.year,
          studentDetails.familyIncomeUnder3Lakhs,
        ],
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
      await db
        .insert(zuvyStudentApplicationRecord)
        .values(studentDetails)
        .returning();

      return [
        null,
        {
          message:
            "Thank you for applying! We're reviewing your application and will notify you soon.",
          statusCode: STATUS_CODES.OK,
        },
      ];
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
    
    We're excited to see your interest in the amazing Bootcamp for female engineers.
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
        accessKeyId: JOIN_ZUVY_ACCESS_KEY_ID, // Replace with your access key ID
        secretAccessKey: JOIN_ZUVY_SECRET_KEY, // Replace with your secret access key
        region: 'ap-south-1', // Replace with your AWS SES region, e.g., 'us-east-1'
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
      Logger.log('Email sent successfully:', JSON.stringify(result));
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async enrollData(userId: number, limit?: number, offset?: number) {
    try {
      // Get enrolled bootcamps
      let enrolled = await db.query.zuvyBatchEnrollments.findMany({
        orderBy: (zuvyBatchEnrollments, { desc }) => [
          desc(zuvyBatchEnrollments.createdAt),
        ],
        // type-safety: userId column is bigint, so cast with BigInt() for the typed eq() helper
        where: (zuvyBatchEnrollments, { and, eq, isNotNull }) =>
          and(
            eq(zuvyBatchEnrollments.userId, BigInt(userId)),
            isNotNull(zuvyBatchEnrollments.batchId),
          ),
        columns: {
          id: true,
        },
        with: {
          bootcamp: {
            columns: {
              id: true,
              name: true,
              coverImage: true,
              duration: true,
              language: true,
              bootcampTopic: true,
              description: true,
              organizationId: true,
              createdAt: true,
            },
          },
          batchInfo: {
            columns: {
              id: true,
              name: true,
              instructorId: true,
              startDate: true,
              createdAt: true,
            },
            with: {
              instructorDetails: {
                columns: {
                  id: true,
                  name: true,
                  profilePicture: true,
                },
              },
            },
          },
          tracking: {
            where: (bootcampTracking, { eq }) =>
              eq(bootcampTracking.userId, userId),
          },
        },
      });

      // Deduplicate by bootcamp.id to handle any pre-existing duplicate entries safely
      const seenBootcamps = new Set<number>();
      enrolled = enrolled.filter((e: any) => {
        if (!e.bootcamp || !e.bootcamp.id) return false;
        const bId = Number(e.bootcamp.id);
        if (seenBootcamps.has(bId)) return false;
        seenBootcamps.add(bId);
        return true;
      });

      // Extract unique orgIds and bootcampIds
      const orgIds = Array.from(
        new Set(
          enrolled.map((e: any) => e.bootcamp.organizationId).filter(Boolean),
        ),
      );
      const bootcampIds = Array.from(
        new Set(enrolled.map((e: any) => e.bootcamp.id).filter(Boolean)),
      );

      let allOrgs: any[] = [];
      let allModules: any[] = [];
      let allUserCompletedProjects: any[] = [];

      // Fetch orgs, modules, and project tracking in parallel
      if (bootcampIds.length > 0 || orgIds.length > 0) {
        const promises: any[] = [];

        if (orgIds.length > 0) {
          promises.push(
            db
              .select({
                id: zuvyOrganizations.id,
                title: zuvyOrganizations.title,
              })
              .from(zuvyOrganizations)
              .where(inArray(zuvyOrganizations.id, orgIds))
              .then((res) => {
                allOrgs = res;
              }),
          );
        }

        if (bootcampIds.length > 0) {
          promises.push(
            db
              .select({
                id: zuvyCourseModules.id,
                bootcampId: zuvyCourseModules.bootcampId,
                projectId: zuvyCourseModules.projectId,
              })
              .from(zuvyCourseModules)
              .where(inArray(zuvyCourseModules.bootcampId, bootcampIds))
              .then((res) => {
                allModules = res;
              }),
          );

          promises.push(
            db
              .select({ bootcampId: zuvyProjectTracking.bootcampId })
              .from(zuvyProjectTracking)
              .where(
                and(
                  inArray(zuvyProjectTracking.bootcampId, bootcampIds),
                  eq(zuvyProjectTracking.userId, userId),
                ),
              )
              .then((res) => {
                allUserCompletedProjects = res;
              }),
          );
        }

        await Promise.all(promises);
      }

      const orgMap = {};
      allOrgs.forEach((org) => {
        orgMap[org.id] = org.title;
      });

      let allChapters: any[] = [];
      let allUserCompletedChapters: any[] = [];

      const moduleIds = allModules.map((m) => m.id);

      // Fetch chapters and chapter tracking in parallel
      if (moduleIds.length > 0) {
        await Promise.all([
          db
            .select({ moduleId: zuvyModuleChapter.moduleId })
            .from(zuvyModuleChapter)
            .leftJoin(
              zuvyOutsourseAssessments,
              eq(zuvyModuleChapter.id, zuvyOutsourseAssessments.chapterId),
            )
            .where(
              and(
                inArray(zuvyModuleChapter.moduleId, moduleIds),
                or(
                  isNull(zuvyOutsourseAssessments.currentState),
                  inArray(zuvyOutsourseAssessments.currentState, [1, 2, 3]),
                ),
              ),
            )
            .then((res) => {
              allChapters = res;
            }),
          db
            .select({ moduleId: zuvyChapterTracking.moduleId })
            .from(zuvyChapterTracking)
            .where(
              and(
                inArray(zuvyChapterTracking.moduleId, moduleIds),
                eq(zuvyChapterTracking.userId, BigInt(userId)),
              ),
            )
            .then((res) => {
              allUserCompletedChapters = res;
            }),
        ]);
      }

      const moduleIdToBootcampId = new Map();
      allModules.forEach((m) => moduleIdToBootcampId.set(m.id, m.bootcampId));

      const bootcampProgressData: Record<
        number,
        { totalItems: number; completedItems: number }
      > = {};
      bootcampIds.forEach((id) => {
        bootcampProgressData[id] = { totalItems: 0, completedItems: 0 };
      });

      // Projects are counted by modules having a non-null projectId
      allModules.forEach((m) => {
        if (m.projectId !== null && bootcampProgressData[m.bootcampId]) {
          bootcampProgressData[m.bootcampId].totalItems++;
        }
      });

      allChapters.forEach((c) => {
        const bId = moduleIdToBootcampId.get(c.moduleId);
        if (bId && bootcampProgressData[bId])
          bootcampProgressData[bId].totalItems++;
      });
      allUserCompletedChapters.forEach((c) => {
        const bId = moduleIdToBootcampId.get(c.moduleId);
        if (bId && bootcampProgressData[bId])
          bootcampProgressData[bId].completedItems++;
      });
      allUserCompletedProjects.forEach((p) => {
        if (bootcampProgressData[p.bootcampId])
          bootcampProgressData[p.bootcampId].completedItems++;
      });

      // Process each enrollment, calculate status, and split by progress in a single O(N) pass
      const completedBootcamps: any[] = [];
      const inProgressBootcamps: any[] = [];

      enrolled.forEach((e: any) => {
        const { batchInfo, tracking, bootcamp } = e;
        let progress = tracking?.progress || 0;

        // Recompute progress dynamically using pre-fetched data
        const progData = bootcampProgressData[bootcamp.id] || {
          totalItems: 0,
          completedItems: 0,
        };
        if (progData.totalItems > 0) {
          const completed = Math.min(
            progData.completedItems,
            progData.totalItems,
          );
          progress =
            completed >= progData.totalItems
              ? 100
              : Math.floor((completed / progData.totalItems) * 100);
        } else {
          progress = tracking?.progress || 0;
        }
        progress = Math.min(100, Math.max(0, progress));

        // Determine course ending conditions
        let hasCourseEnded = false;

        const baseDate =
          batchInfo?.startDate ?? batchInfo?.createdAt ?? bootcamp.createdAt;
        const durationWeeks = Number(bootcamp.duration ?? 0);

        if (baseDate && Number.isFinite(durationWeeks) && durationWeeks > 0) {
          const endDate = new Date(baseDate);
          endDate.setDate(endDate.getDate() + durationWeeks * 7);
          hasCourseEnded = endDate <= new Date();
        }

        let isCompletedStatus = false;
        if (progress === 100 && hasCourseEnded) {
          isCompletedStatus = true;
        }

        const formattedData = {
          ...bootcamp,
          id: Number(bootcamp.id),
          courseOrgId: bootcamp.organizationId || null,
          courseOrgName: bootcamp.organizationId
            ? orgMap[bootcamp.organizationId]
            : null,
          batchId: batchInfo?.id ? Number(batchInfo.id) : null,
          batchName: batchInfo?.name,
          progress,
          isCompletedStatus,
          instructorDetails: batchInfo?.instructorDetails
            ? {
                ...batchInfo.instructorDetails,
                id: Number(batchInfo.instructorDetails.id),
              }
            : { name: 'Not Assigned', profilePicture: null },
        };

        if (isCompletedStatus) {
          completedBootcamps.push(formattedData);
        } else {
          inProgressBootcamps.push(formattedData);
        }
      });

      // Apply pagination if limit and offset are provided
      const paginateArray = (arr: any[], limit?: number, offset?: number) => {
        if (!limit || !offset) return arr;
        return arr.slice(offset, offset + limit);
      };

      const paginatedCompletedBootcamps = paginateArray(
        completedBootcamps,
        limit,
        offset,
      );
      const paginatedInProgressBootcamps = paginateArray(
        inProgressBootcamps,
        limit,
        offset,
      );

      return [
        null,
        {
          completedBootcamps: paginatedCompletedBootcamps,
          inProgressBootcamps: paginatedInProgressBootcamps,
          totalCompleted: completedBootcamps.length,
          totalInProgress: inProgressBootcamps.length,
          totalPages: limit
            ? Math.ceil(
                Math.max(
                  completedBootcamps.length,
                  inProgressBootcamps.length,
                ) / limit,
              )
            : 1,
        },
      ];
    } catch (err) {
      error(`error: ${err.message}`);
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }

  async enrollmentData(bootcampId: number) {
    try {
      // perf: count() aggregates instead of fetching full rows + .length, run in parallel
      const [[enrolledCount], [unEnrolledCount]] = await Promise.all([
        db
          .select({ count: count() })
          .from(zuvyBatchEnrollments)
          .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId)),
        db
          .select({ count: count() })
          .from(zuvyBatchEnrollments)
          .where(
            and(
              eq(zuvyBatchEnrollments.bootcampId, bootcampId),
              isNull(zuvyBatchEnrollments.batchId),
            ),
          ),
      ]);
      return [
        null,
        {
          students_in_bootcamp: enrolledCount.count,
          unassigned_students: unEnrolledCount.count,
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
        .innerJoin(
          zuvyBootcampType,
          eq(zuvyBootcamps.id, zuvyBootcampType.bootcampId),
        )
        .where(
          and(
            eq(zuvyBootcampType.type, 'Public'),
            sql`LOWER(${zuvyBootcamps.name}) LIKE ${searchTerm.toLowerCase()} || '%'`,
          ),
        );
      let data = await Promise.all(
        getPubliczuvyBootcamps.map(async (bootcamp) => {
          let [err, res] = await this.enrollmentData(
            bootcamp.zuvy_bootcamp_type.bootcampId,
          );
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
        .innerJoin(
          zuvyBootcampType,
          eq(zuvyBootcamps.id, zuvyBootcampType.bootcampId),
        )
        .where(eq(zuvyBootcampType.type, 'Public'));
      let data = await Promise.all(
        getPubliczuvyBootcamps.map(async (bootcamp) => {
          let [err, res] = await this.enrollmentData(
            bootcamp.zuvy_bootcamp_type.bootcampId,
          );
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

  async fetchGlobalCourses(userId?: number) {
    try {
      // Fetch public bootcamps
      let publicBootcamps = await db
        .select({
          bootcamp: zuvyBootcamps,
          bootcampType: zuvyBootcampType,
          organization: zuvyOrganizations,
        })
        .from(zuvyBootcamps)
        .innerJoin(
          zuvyBootcampType,
          eq(zuvyBootcamps.id, zuvyBootcampType.bootcampId),
        )
        .leftJoin(
          zuvyOrganizations,
          eq(zuvyBootcamps.organizationId, zuvyOrganizations.id),
        )
        .where(eq(zuvyBootcampType.type, 'Public'));

      if (userId) {
        const enrolled = await db
          .select({ bootcampId: zuvyBatchEnrollments.bootcampId })
          .from(zuvyBatchEnrollments)
          .where(eq(zuvyBatchEnrollments.userId, BigInt(userId)));
        const enrolledBootcampIds = new Set(
          enrolled.map((e) => Number(e.bootcampId)),
        );
        publicBootcamps = publicBootcamps.filter(
          (b) => !enrolledBootcampIds.has(Number(b.bootcamp.id)),
        );
      }

      // Fetch the batches for every remaining bootcamp in a single query
      // (instead of one findFirst() per bootcamp inside the map below),
      // then pick the most recently created batch per bootcamp in memory.
      const allBootcampIds = publicBootcamps.map((r) => r.bootcamp.id);
      const allBatches = allBootcampIds.length
        ? await db.query.zuvyBatches.findMany({
            where: (zuvyBatchesTable, { inArray }) =>
              inArray(zuvyBatchesTable.bootcampId, allBootcampIds),
            orderBy: (zuvyBatchesTable, { desc }) => [
              desc(zuvyBatchesTable.createdAt),
            ],
            with: {
              instructorDetails: {
                columns: {
                  name: true,
                  profilePicture: true,
                },
              },
            },
          })
        : [];

      // allBatches is sorted globally by createdAt desc, so the first
      // occurrence encountered per bootcampId is that bootcamp's most
      // recently created batch — same pick as the original findFirst().
      const firstBatchByBootcampId = new Map<number, any>();
      allBatches.forEach((batch) => {
        const bId = Number(batch.bootcampId);
        if (!firstBatchByBootcampId.has(bId)) {
          firstBatchByBootcampId.set(bId, batch);
        }
      });

      let data = await Promise.all(
        publicBootcamps.map(async (bootcampRecord) => {
          const { bootcamp, bootcampType, organization } = bootcampRecord;
          let [err, res] = await this.enrollmentData(bootcamp.id);

          const firstBatch = firstBatchByBootcampId.get(bootcamp.id) || null;

          return {
            ...bootcamp,
            ...bootcampType,
            batchInfo: firstBatch,
            enrolledInfo: res,
            courseOrgId: organization?.id || null,
            courseOrgName: organization?.title || null,
          };
        }),
      );
      return [null, data];
    } catch (err) {
      this.logger.error(`error: ${err.message}`);
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }

  async enrollInPublicCourse(userId: number, bootcampId: number) {
    try {
      // Verify public bootcamp
      const isPublic = await db
        .select()
        .from(zuvyBootcampType)
        .where(
          and(
            eq(zuvyBootcampType.bootcampId, bootcampId),
            eq(zuvyBootcampType.type, 'Public'),
          ),
        );

      if (!isPublic || isPublic.length === 0) {
        return [
          {
            status: 'error',
            message: 'This course is not public or does not exist.',
            code: 400,
          },
          null,
        ];
      }

      // Check if user is already enrolled before doing any batch work.
      // The JwtAuthGuard skips auto-enroll for this endpoint, so an
      // existing record here means the student genuinely enrolled before.
      const existingEnrollment = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(
          and(
            eq(zuvyBatchEnrollments.userId, BigInt(userId)),
            eq(zuvyBatchEnrollments.bootcampId, bootcampId),
          ),
        );

      if (existingEnrollment && existingEnrollment.length > 0) {
        return [
          {
            status: 'error',
            message: 'Already enrolled in this course.',
            code: 400,
          },
          null,
        ];
      }

      // Find an available batch where capEnrollment > enrollments
      const batches = await db
        .select()
        .from(zuvyBatches)
        .where(eq(zuvyBatches.bootcampId, bootcampId))
        .orderBy(asc(zuvyBatches.createdAt));

      let selectedBatchId = null;
      for (const batch of batches) {
        const enrollmentsCounts = await db
          .select({ count: count() })
          .from(zuvyBatchEnrollments)
          .where(eq(zuvyBatchEnrollments.batchId, batch.id));

        const currentCount = enrollmentsCounts[0].count;
        if (!batch.capEnrollment || currentCount < batch.capEnrollment) {
          selectedBatchId = batch.id;
          break;
        }
      }

      if (!selectedBatchId) {
        // All existing batches are full — create a new unlimited-capacity overflow batch
        const bootcampRes = await db
          .select({ name: zuvyBootcamps.name })
          .from(zuvyBootcamps)
          .where(eq(zuvyBootcamps.id, bootcampId))
          .limit(1);

        const bootcampName = bootcampRes[0]?.name || 'Bootcamp';
        const newBatchName = `${bootcampName} - Batch ${batches.length + 1}`;

        const [newBatch] = await db
          .insert(zuvyBatches)
          .values({
            name: newBatchName,
            bootcampId,
            // capEnrollment omitted → null in DB (unlimited enrollment)
          } as any)
          .returning();

        selectedBatchId = newBatch.id;
      }

      // Create enrollment
      const userEnroll = await db
        .insert(zuvyBatchEnrollments)
        .values({
          userId: BigInt(userId),
          bootcampId,
          batchId: selectedBatchId,
        })
        .returning();

      return [
        null,
        { message: 'Successfully enrolled in the course.', data: userEnroll },
      ];
    } catch (err) {
      this.logger.error(`error: ${err.message}`);
      return [{ status: 'error', message: err.message, code: 500 }, null];
    }
  }

  async removingStudent(
    user_id: number | number[],
    bootcamp_id: number,
    requester?: any,
  ) {
    try {
      const userIdsArray = Array.isArray(user_id) ? user_id : [user_id];
      const requesterRoles = requester?.roles || [];
      const isInstructorOnly =
        requesterRoles.includes('instructor') &&
        !requesterRoles.some((role: string) =>
          ['admin', 'ops', 'super_admin'].includes(role),
        );

      if (isInstructorOnly) {
        const targetEnrollments = await db
          .select({
            userId: zuvyBatchEnrollments.userId,
            batchId: zuvyBatchEnrollments.batchId,
            instructorId: zuvyBatches.instructorId,
          })
          .from(zuvyBatchEnrollments)
          .leftJoin(
            zuvyBatches,
            eq(zuvyBatchEnrollments.batchId, zuvyBatches.id),
          )
          .where(
            and(
              inArray(zuvyBatchEnrollments.userId, userIdsArray.map(BigInt)),
              eq(zuvyBatchEnrollments.bootcampId, bootcamp_id),
            ),
          );

        if (targetEnrollments.length === 0) {
          return [
            { status: 'error', message: 'ID not found', code: 404 },
            null,
          ];
        }

        const canManageAllTargets = targetEnrollments.every(
          (enrollment) =>
            enrollment.batchId !== null &&
            Number(enrollment.instructorId) === Number(requester.id),
        );

        if (!canManageAllTargets) {
          return [
            {
              status: 'error',
              message: 'Unauthorized access',
              code: 403,
            },
            null,
          ];
        }
      }

      // Fetch user details before deletion so tracking log can show real names
      const removedUsers = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, userIdsArray.map(BigInt)));

      let enrolled = await db
        .delete(zuvyBatchEnrollments)
        .where(
          and(
            inArray(zuvyBatchEnrollments.userId, userIdsArray.map(BigInt)),
            eq(zuvyBatchEnrollments.bootcampId, bootcamp_id),
          ),
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
            inArray(zuvyBootcampTracking.userId, userIdsArray.map(Number)),
            eq(zuvyBootcampTracking.bootcampId, Number(bootcamp_id)),
          ),
        )
        .returning();

      const deletedCount = enrolled.length;

      const courseRes = await db
        .select({ name: zuvyBootcamps.name })
        .from(zuvyBootcamps)
        .where(eq(zuvyBootcamps.id, bootcamp_id))
        .limit(1);
      const bootcampName = courseRes[0]?.name || '';

      return [
        null,
        {
          status: 'true',
          message:
            deletedCount === 1
              ? 'Student removed from the bootcamp'
              : `${deletedCount} students removed from the bootcamp`,
          code: 200,
          removedUsers,
          bootcampId: Number(bootcamp_id),
          descriptionPrefix: 'the student',
          bootcampName,
        },
      ];
    } catch (e) {
      return [{ status: 'error', message: e.message, code: 500 }, null];
    }
  }

  async getUpcomingClass(
    student_id: number,
    batchID: number,
    limit: number,
    offset: number,
  ): Promise<any> {
    try {
      // type-safety: userId column is bigint, so cast with BigInt() for the typed eq() helper
      let queryString;
      if (batchID) {
        queryString = and(
          eq(zuvyBatchEnrollments.userId, BigInt(student_id)),
          eq(zuvyBatchEnrollments.batchId, batchID),
        );
      } else {
        queryString = and(
          eq(zuvyBatchEnrollments.userId, BigInt(student_id)),
          isNotNull(zuvyBatchEnrollments.batchId),
        );
      }
      let enrolled = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(queryString);

      if (enrolled.length == 0) {
        return [
          null,
          {
            message: 'not enrolled in any course.',
            statusCode: STATUS_CODES.OK,
            data: [],
          },
        ];
      }
      let bootcampAndbatchIds = await Promise.all(
        enrolled
          .filter((e) => e.batchId !== null)
          .map(async (e) => {
            await this.ClassesService.updatingStatusOfClass(
              e.bootcampId,
              e.batchId,
            );
            return { bootcampId: e.bootcampId, batchId: e.batchId };
          }),
      );
      let upcomingClasses = await db.query.zuvySessions.findMany({
        where: (session, { and, or, eq, ne }) =>
          and(
            or(
              ...bootcampAndbatchIds.map(({ bootcampId, batchId }) =>
                and(
                  eq(session.bootcampId, bootcampId),
                  eq(session.batchId, batchId),
                ),
              ),
            ),
            ne(session.status, helperVariable.completed),
          ),
        orderBy: (session, { asc }) => asc(session.startTime),
        with: {
          bootcampDetail: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
        extras: {
          totalCount: sql<number>`coalesce(count(*) over(), 0)`.as(
            'total_count',
          ),
        },
        limit,
        offset,
      });
      const totalCount =
        upcomingClasses.length > 0 ? upcomingClasses[0]['totalCount'] : 0;

      const totalClasses = totalCount;
      let filterClasses = upcomingClasses.reduce(
        (acc, e: any) => {
          e['bootcampName'] = e['bootcampDetail'].name;
          e['bootcampId'] = e['bootcampDetail'].id;
          delete e['bootcampDetail'];
          delete e['totalCount'];
          if (e.status == helperVariable.upcoming) {
            acc.upcoming.push(e);
          } else {
            acc.ongoing.push(e);
          }
          return acc;
        },
        { upcoming: [], ongoing: [] },
      );
      if (Number(totalClasses) == 0) {
        return [
          null,
          {
            message: 'No upcoming classes',
            statusCode: STATUS_CODES.OK,
            data: [],
          },
        ];
      }
      return [
        null,
        {
          message: 'Upcoming classes fetched successfully',
          statusCode: STATUS_CODES.OK,
          data: {
            filterClasses,
            totalClasses: Number(totalClasses),
            totalPages: !isNaN(limit) ? Math.ceil(totalClasses / limit) : 1,
          },
        },
      ];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  async getUpcomingEvents(
    student_id: number,
    limit?: number,
    offset?: number,
    bootcampId?: number,
  ): Promise<any> {
    try {
      // type-safety: userId column is bigint, so cast with BigInt() for the typed eq() helper
      let query;
      if (bootcampId) {
        query = and(
          eq(zuvyBatchEnrollments.userId, BigInt(student_id)),
          eq(zuvyBatchEnrollments.bootcampId, bootcampId),
          isNotNull(zuvyBatchEnrollments.batchId),
        );
      } else {
        query = and(
          eq(zuvyBatchEnrollments.userId, BigInt(student_id)),
          isNotNull(zuvyBatchEnrollments.batchId),
        );
      }
      const enrolled = await db
        .select({
          bootcampId: zuvyBatchEnrollments.bootcampId,
          batchId: zuvyBatchEnrollments.batchId,
        })
        .from(zuvyBatchEnrollments)
        .where(query);

      if (enrolled.length === 0) {
        return [
          null,
          {
            message: 'Not enrolled in any course.',
            statusCode: STATUS_CODES.OK,
            data: [],
          },
        ];
      }

      const bootcampAndbatchIds = enrolled.map((e) => ({
        bootcampId: e.bootcampId,
        batchId: e.batchId,
      }));

      await Promise.all(
        bootcampAndbatchIds.map(({ bootcampId, batchId }) =>
          this.ClassesService.updatingStatusOfClass(bootcampId, batchId),
        ),
      );

      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const upcomingClassesPromise = db.query.zuvySessions.findMany({
        where: (session, { and, or, eq, ne, sql }) =>
          and(
            or(
              ...bootcampAndbatchIds.map(({ bootcampId, batchId }) =>
                and(
                  eq(session.bootcampId, bootcampId),
                  or(
                    eq(session.batchId, batchId),
                    eq(session.secondBatchId, batchId),
                  ),
                ),
              ),
            ),
            ne(session.status, helperVariable.completed),
            sql`${session.startTime}::timestamp < ${sevenDaysLater.toISOString()}`,
          ),
        orderBy: (session, { asc }) => asc(session.startTime),
        columns: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          status: true,
          batchId: true,
          bootcampId: true,
          chapterId: true,
          hangoutLink: true,
        },
        with: {
          bootcampDetail: {
            columns: {
              id: true,
              name: true,
            },
          },
          module: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      const upcomingAssessmentsPromise = db
        .select({
          id: zuvyOutsourseAssessments.id,
          startDatetime: zuvyOutsourseAssessments.startDatetime,
          endDatetime: zuvyOutsourseAssessments.endDatetime,
          bootcampId: zuvyOutsourseAssessments.bootcampId,
          timeLimit: zuvyOutsourseAssessments.timeLimit,
          currentStatus: zuvyOutsourseAssessments.currentState,
          moduleName: zuvyCourseModules.name,
          moduleId: zuvyCourseModules.id,
          title: zuvyModuleAssessment.title,
          bootcampName: zuvyBootcamps.name,
          chapterId: zuvyOutsourseAssessments.chapterId,
        })
        .from(zuvyOutsourseAssessments)
        .innerJoin(
          zuvyModuleAssessment,
          eq(zuvyOutsourseAssessments.assessmentId, zuvyModuleAssessment.id),
        )
        .innerJoin(
          zuvyBootcamps,
          eq(zuvyOutsourseAssessments.bootcampId, zuvyBootcamps.id),
        )
        .innerJoin(
          zuvyCourseModules,
          eq(zuvyOutsourseAssessments.moduleId, zuvyCourseModules.id),
        )
        .leftJoin(
          zuvyAssessmentSubmission,
          and(
            eq(
              zuvyAssessmentSubmission.assessmentOutsourseId,
              zuvyOutsourseAssessments.id,
            ),
            eq(zuvyAssessmentSubmission.userId, student_id),
          ),
        )
        .where(
          and(
            inArray(
              zuvyOutsourseAssessments.bootcampId,
              bootcampAndbatchIds.map((b) => b.bootcampId),
            ),
            sql`
              (
                (${zuvyOutsourseAssessments.startDatetime}::timestamp >= ${now.toISOString()} AND ${zuvyOutsourseAssessments.startDatetime}::timestamp <= ${sevenDaysLater.toISOString()})
                OR
                (${zuvyOutsourseAssessments.startDatetime}::timestamp <= ${now.toISOString()} AND ${zuvyOutsourseAssessments.endDatetime} IS NULL)
                OR
                (${zuvyOutsourseAssessments.startDatetime}::timestamp <= ${now.toISOString()} AND ${zuvyOutsourseAssessments.endDatetime}::timestamp > ${now.toISOString()} AND ${zuvyOutsourseAssessments.endDatetime}::timestamp <= ${sevenDaysLater.toISOString()})
              )
              AND ${zuvyOutsourseAssessments.currentState} IN (1, 2)
            `,
            isNull(zuvyAssessmentSubmission.id),
          ),
        )
        .orderBy(asc(zuvyOutsourseAssessments.startDatetime));

      let upcomingAssignmentsPromise = db
        .select({
          id: zuvyModuleChapter.id,
          chapterId: zuvyModuleChapter.id,
          title: zuvyModuleChapter.title,
          description: zuvyModuleChapter.description,
          completionDate: zuvyModuleChapter.completionDate,
          moduleName: zuvyCourseModules.name,
          moduleId: zuvyCourseModules.id,
          bootcampId: zuvyCourseModules.bootcampId,
        })
        .from(zuvyModuleChapter)
        .innerJoin(
          zuvyCourseModules,
          eq(zuvyModuleChapter.moduleId, zuvyCourseModules.id),
        )
        .leftJoin(
          zuvyAssignmentSubmission,
          and(
            eq(zuvyAssignmentSubmission.userId, student_id),
            eq(zuvyAssignmentSubmission.chapterId, zuvyModuleChapter.id),
          ),
        )
        .where(
          and(
            eq(zuvyModuleChapter.topicId, 5), // topicId 5 = assignment
            inArray(
              zuvyCourseModules.bootcampId,
              bootcampAndbatchIds.map((b) => b.bootcampId),
            ),
            sql`${zuvyModuleChapter.completionDate}::timestamp >= ${now.toISOString()} AND ${zuvyModuleChapter.completionDate}::timestamp <= ${sevenDaysLater.toISOString()}`,
            isNull(zuvyAssignmentSubmission.id),
          ),
        )
        .orderBy(asc(zuvyModuleChapter.completionDate));

      // Independent of the above lookups (only depends on student_id), so
      // run it concurrently in the same Promise.all instead of after it.
      const upcomingMentorSessionsPromise = db
        .select({
          id: zuvyMentorSlotBooking.id,
          mentorName: users.name,
          slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
          slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
          topic: zuvyMentorSlotAvailability.topic,
          meetingLink: zuvyMentorSlotBooking.meetingLink,
          meetingType: zuvyMentorSlotAvailability.meetingType,
          slotType: zuvyMentorSlotAvailability.slotType,
          sessionStatus: zuvyMentorSlotBooking.sessionLifecycleState,
          bookingStatus: zuvyMentorSlotBooking.status,
        })
        .from(zuvyMentorSlotBooking)
        .leftJoin(users, eq(users.id, zuvyMentorSlotBooking.mentorUserId))
        .leftJoin(
          zuvyMentorSlotAvailability,
          eq(
            zuvyMentorSlotAvailability.id,
            zuvyMentorSlotBooking.slotAvailabilityId,
          ),
        )
        .where(
          and(
            eq(zuvyMentorSlotBooking.studentUserId, BigInt(student_id)),
            eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
          ),
        )
        .orderBy(asc(zuvyMentorSlotAvailability.slotStartDateTime));

      const [
        upcomingClasses,
        upcomingAssessments,
        upcomingAssignments,
        upcomingMentorSessions,
      ] = await Promise.all([
        upcomingClassesPromise,
        upcomingAssessmentsPromise,
        upcomingAssignmentsPromise,
        upcomingMentorSessionsPromise,
      ]);

      const formattedClasses = (upcomingClasses as any[]).map((c) => ({
        type: 'Live Class' as const,
        id: Number(c.id),
        title: c.title,
        startTime: c.startTime,
        endTime: c.endTime,
        status: c.status,
        moduleName: c.module?.name,
        moduleId: c.module?.id,
        bootcampId: Number(c.bootcampId),
        bootcampName: c.bootcampDetail?.name || 'Unknown Bootcamp',
        batchId: Number(c.batchId),
        chapterId: Number(c.chapterId),
        eventDate: c.startTime,
        hangoutLink: c.hangoutLink,
      }));

      const formattedAssessments = upcomingAssessments.map((a) => ({
        type: 'Assessment' as const,
        id: Number(a.id),
        title: a.title || 'Assessment',
        startDatetime: a.startDatetime,
        endDatetime: a.endDatetime,
        bootcampId: Number(a.bootcampId),
        bootcampName: a.bootcampName || 'Unknown Bootcamp',
        moduleName: a.moduleName,
        moduleId: a.moduleId,
        timeLimit: a.timeLimit,
        chapterId: a.chapterId,
        eventDate: a.startDatetime,
      }));

      const formattedAssignments = upcomingAssignments.map((a) => ({
        type: 'Assignment' as const,
        id: Number(a.id),
        title: a.title || 'Assignment',
        description: a.description,
        bootcampId: Number(a.bootcampId),
        moduleName: a.moduleName,
        moduleId: a.moduleId,
        bootcampName: a.bootcampId || 'Unknown Bootcamp',
        completionDate: a.completionDate,
        chapterId: a.chapterId,
        eventDate: a.completionDate,
      }));

      const formattedMentorSessions = upcomingMentorSessions.map((s) => ({
        type: 'Mentor Session' as const,
        id: Number(s.id),
        mentorName: s.mentorName || 'Mentor',
        title: s.topic || 'Mentor Session',
        startTime: s.slotStart,
        endTime: s.slotEnd,
        sessionStatus: s.sessionStatus,
        bookingStatus: s.bookingStatus,
        meetingLink: s.meetingLink,
        meetingType: s.meetingType,
        slotType: s.slotType,
        eventDate: s.slotStart,
      }));

      const allEvents = [
        ...formattedClasses,
        ...formattedAssessments,
        ...formattedAssignments,
      ].sort(
        (a, b) =>
          new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime(),
      );

      const totalEvents = allEvents.length;
      const paginatedEvents =
        limit || offset
          ? allEvents.slice(offset || 0, (offset || 0) + (limit || totalEvents))
          : allEvents;
      const totalPages = limit ? Math.ceil(totalEvents / limit) : 1;

      return [
        null,
        {
          message: 'Upcoming events fetched successfully',
          statusCode: STATUS_CODES.OK,
          data: {
            events: paginatedEvents,
            totalEvents,
            totalPages,
            mentorSessions: formattedMentorSessions,
          },
        },
      ];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  async getAttendanceClass(student_id: number) {
    try {
      // type-safety: userId column is bigint, so cast with BigInt() for the typed eq() helper
      let enrolled = await db.query.zuvyBatchEnrollments.findMany({
        where: (zuvyBatchEnrollments, { eq }) =>
          eq(zuvyBatchEnrollments.userId, BigInt(student_id)),
        with: {
          bootcamp: {
            id: true,
            name: true,
          },
        },
      });

      if (enrolled.length == 0) {
        return [
          {
            status: 'error',
            message: 'not enrolled in any course.',
            code: 404,
          },
          null,
        ];
      }

      // Fetch completed sessions for all enrolled batches in a single query
      // instead of one query per enrollment, then group them in memory.
      const batchIds = Array.from(
        new Set(
          enrolled.map((e: any) => e.batchId).filter((id: any) => id != null),
        ),
      );

      const allClasses = batchIds.length
        ? await db
            .select()
            .from(zuvySessions)
            .where(
              and(
                inArray(zuvySessions.batchId, batchIds),
                eq(zuvySessions.status, 'completed'),
              ),
            )
            .orderBy(desc(zuvySessions.startTime))
        : [];

      const classesByBatchId = new Map<number, any[]>();
      allClasses.forEach((session: any) => {
        const list = classesByBatchId.get(session.batchId) || [];
        list.push(session);
        classesByBatchId.set(session.batchId, list);
      });

      let totalAttendance = enrolled.map((e: any) => {
        const classes = classesByBatchId.get(e.batchId) || [];
        e.attendance = e.attendance != null ? e.attendance : 0;
        e.totalClasses = classes.length;
        e.attendedClasses =
          classes.length > 0 && e.attendance > 0
            ? ((e.attendance / classes.length) * 100).toFixed(2)
            : 0;
        delete e.userId;
        delete e.bootcamp;
        return e;
      });
      return totalAttendance;
    } catch (err) {
      throw err;
    }
  }

  async getCompletedClassesWithAttendance(
    userId: number,
    bootcampId: number,
    limit,
    offset,
    searchTerm?: string,
    attendanceStatus?: string,
    fromDate?: Date,
    toDate?: Date,
  ) {
    try {
      const hasFrom = fromDate instanceof Date && !isNaN(fromDate.getTime());
      const hasTo = toDate instanceof Date && !isNaN(toDate.getTime());

      if ((hasFrom && !hasTo) || (!hasFrom && hasTo)) {
        return [
          {
            message:
              'Both "from" and "to" are required when filtering by date.',
            statusCode: STATUS_CODES.BAD_REQUEST,
          },
        ];
      }

      if (hasFrom && hasTo) {
        fromDate = new Date(fromDate!);
        toDate = new Date(toDate!);
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
          return [
            {
              message:
                'Invalid "from" or "to" date format. Use ISO strings (e.g., 2025-08-01 or 2025-08-01T00:00:00Z).',
              statusCode: STATUS_CODES.BAD_REQUEST,
            },
          ];
        }
        if (fromDate > toDate) {
          return [
            {
              message: '"from" must be earlier than or equal to "to".',
              statusCode: STATUS_CODES.BAD_REQUEST,
            },
          ];
        }
      }

      const userRecord = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, BigInt(userId)));

      if (userRecord.length === 0) {
        return [
          { message: 'User not found', statusCode: STATUS_CODES.NOT_FOUND },
        ];
      }

      const userEmail = userRecord[0].email.toLowerCase();

      // Find the batch the user is enrolled in for this bootcamp
      const batchData = await db
        .select({ batchId: zuvyBatchEnrollments.batchId })
        .from(zuvyBatchEnrollments)
        .where(
          and(
            eq(zuvyBatchEnrollments.userId, BigInt(userId)),
            eq(zuvyBatchEnrollments.bootcampId, bootcampId),
          ),
        );

      if (batchData.length === 0 || !batchData[0].batchId) {
        return [
          {
            message: 'Batch not found for student',
            statusCode: STATUS_CODES.NOT_FOUND,
          },
        ];
      }

      const batchId = batchData[0].batchId as number;

      // 1. Fetch all completed sessions for the batch (unfiltered by
      // pagination — limit/offset must never shrink the set the stats are
      // computed from, only the class list returned for display).
      const allSessions =
        await this.attendanceCalc.getCompletedSessionsForBatch(batchId, {
          bootcampId,
          searchTerm,
          fromDate,
          toDate,
        });
      const totalClasses = allSessions.length;
      if (totalClasses === 0) {
        return [
          null,
          {
            message: 'No completed classes found',
            statusCode: STATUS_CODES.OK,
            data: {
              batchId,
              batchName: null,
              classes: [],
              totalClasses: 0,
              totalPages: 0,
              attendanceStats: {
                presentCount: 0,
                absentCount: 0,
                attendancePercentage: 0,
              },
            },
          },
        ];
      }

      const batchName = allSessions[0]?.batchName ?? null;

      // 2. Build the unified (Zoom + legacy Google Meet) attendance map for this student
      const unifiedAttendanceMap =
        await this.attendanceCalc.getUnifiedAttendanceMap(allSessions, {
          userId,
          userEmail,
        });

      // 3. Map classes to the final result structure using the unified map
      const result = allSessions.map((cls) => {
        const userAttendance = unifiedAttendanceMap.get(cls.id)?.get(userId);
        const status = userAttendance?.status || 'absent';
        const duration = userAttendance?.duration || 0;

        return {
          id: cls.id,
          title: cls.title,
          startTime: cls.startTime,
          endTime: cls.endTime,
          s3Link: cls.s3link,
          moduleId: cls.moduleId,
          chapterId: cls.chapterId,
          attendanceStatus: status,
          duration,
        };
      });

      // 4. Overall attendance stats are computed off the FULL completed-class
      // set, before the attendanceStatus filter or pagination below are
      // applied — those only affect which rows are returned for display.
      const { presentCount, absentCount, attendancePercentage } =
        this.attendanceCalc.aggregateForUser(
          allSessions,
          unifiedAttendanceMap,
          userId,
        );

      // Filter results by attendance status if specified (display only)
      const filteredResults = attendanceStatus
        ? result.filter((cls) => cls.attendanceStatus === attendanceStatus)
        : result;

      // Recalculate pagination after filtering (display only)
      const totalFilteredClasses = filteredResults.length;
      const paginatedFilteredResults = limit
        ? filteredResults.slice(offset || 0, (offset || 0) + limit)
        : filteredResults;

      // 5. Return the final, consistently structured response
      return [
        null,
        {
          message: 'Completed classes fetched successfully',
          statusCode: STATUS_CODES.OK,
          data: {
            batchId,
            batchName,
            classes: paginatedFilteredResults,
            totalClasses: totalFilteredClasses,
            totalPages: limit ? Math.ceil(totalFilteredClasses / limit) : 1,
            searchTerm: searchTerm || null,
            attendanceStats: {
              presentCount,
              absentCount,
              attendancePercentage,
            },
          },
        },
      ];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  async getLeaderBoardDetailByBootcamp(
    bootcampId: number,
    limit: number,
    offset: number,
  ) {
    try {
      // fix: zuvyBootcampTracking has no unique constraint on
      // (userId, bootcampId) — the app writes it via a non-atomic
      // select-then-insert-or-update, so duplicate rows for the same user
      // are possible. The old relational `one()` fetch could only ever
      // return one nested tracking object per student; a plain leftJoin can
      // fan out and duplicate a student's whole row if duplicates exist. Use
      // max()/GROUP BY so the join always collapses back to one row per
      // enrollment regardless of how many tracking rows match.
      const progressExpr = sql`coalesce(max(${zuvyBootcampTracking.progress}), 0)`;
      const updatedAtExpr = sql`coalesce(max(${zuvyBootcampTracking.updatedAt}), now())`;
      // averageScore = (attendance + progress) / 2, computed in SQL so the
      // sort + pagination can happen at the DB level instead of pulling
      // every enrolled student's full nested tracking data into memory.
      // (division by 2.0 forces float math in Postgres, matching the
      // original JS `(attendance + progress) / 2` — plain integer division
      // would silently truncate e.g. 4.5 to 4 and change the response value.)
      const averageScoreExpr = sql`(coalesce(${zuvyBatchEnrollments.attendance}, 0) + ${progressExpr}) / 2.0`;

      const studentsWhere = and(
        eq(zuvyBatchEnrollments.bootcampId, bootcampId),
        isNotNull(zuvyBatchEnrollments.batchId),
      );

      const studentsBaseQuery = db
        .select({
          attendance: zuvyBatchEnrollments.attendance,
          userId: users.id,
          userName: users.name,
          userEmail: users.email,
          progress: progressExpr,
          updatedAt: updatedAtExpr,
          averageScore: averageScoreExpr,
        })
        .from(zuvyBatchEnrollments)
        .leftJoin(users, eq(zuvyBatchEnrollments.userId, users.id))
        .leftJoin(
          zuvyBootcampTracking,
          and(
            eq(zuvyBootcampTracking.userId, zuvyBatchEnrollments.userId),
            eq(zuvyBootcampTracking.bootcampId, bootcampId),
          ),
        )
        .where(studentsWhere)
        .groupBy(
          zuvyBatchEnrollments.id,
          users.id,
          users.name,
          users.email,
          zuvyBatchEnrollments.attendance,
        )
        .orderBy(desc(averageScoreExpr), asc(updatedAtExpr));

      const hasPagination = !isNaN(limit) && !isNaN(offset);
      const studentRowsPromise = hasPagination
        ? studentsBaseQuery.limit(limit).offset(offset)
        : studentsBaseQuery;

      const [bootcampRows, studentRows, totalStudentsRows] = await Promise.all([
        db.query.zuvyBootcamps.findMany({
          where: (bootcamp, { eq }) => eq(bootcamp.id, bootcampId),
        }),
        studentRowsPromise,
        db
          .select({ count: count() })
          .from(zuvyBatchEnrollments)
          .where(studentsWhere),
      ]);

      const totalStudents = totalStudentsRows[0]?.count || 0;
      const totalPages = !isNaN(limit) ? Math.ceil(totalStudents / limit) : 1;

      const studentsWithAvg = studentRows.map((row) => {
        const progress = row.progress != null ? row.progress : 0;
        const updatedAt =
          row.updatedAt != null ? row.updatedAt : new Date().toISOString();
        const attendance = row.attendance != null ? row.attendance : 0;
        return {
          attendance,
          userTracking: { progress, updatedAt },
          userInfo: {
            id: Number(row.userId),
            name: row.userName,
            email: row.userEmail,
            averageScore: Number(row.averageScore),
          },
        };
      });

      const processedData = bootcampRows.map((bootcamp) => ({
        ...bootcamp,
        students: studentsWithAvg,
        totalStudents,
        totalPages,
      }));
      return processedData;
    } catch (err) {
      throw err;
    }
  }
  // Helper method to send email to admin using AWS SES
  private async sendEmailToAdmin(submission: any): Promise<any> {
    try {
      AWS.config.update({
        accessKeyId: AWS_QUERY_ACCESS_KEY_ID, // Replace with your access key ID
        secretAccessKey: AWS_QUERY_ACCESS_SECRET_KEY, // Replace with your secret access key
        region: 'ap-south-1', // Replace with your AWS SES region, e.g., 'us-east-1'
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
      this.logger.log(
        'Email sent to admin for re-attempt request: ' + JSON.stringify(result),
      );
      return [null, result];
    } catch (error) {
      this.logger.error('Failed to send email to admin', error);
      return [error, null];
    }
  }

  // Format date to "29 Apr 2025, 03:45 PM" format
  private formatDate(dateString: string): string {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';

      // Format: Day Month Year, Hours:Minutes AM/PM
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (error) {
      return 'N/A';
    }
  }

  // Generate email content dynamically for admin notification
  private async generateAdminEmailContent(submission: any): Promise<string> {
    return `
Hi Admin,

${submission.name} (${submission.email}) from ${submission.courseName || 'N/A'} – ${submission.batchName || 'N/A'} has requested a re‑attempt for the assessment " ${submission.title || 'N/A'}".

Request details

• Student ID: ${submission.userId}  
• Course: ${submission.courseName || 'N/A'}  
• Batch: ${submission.batchName || 'N/A'}  
• Assessment: ${submission.title || 'N/A'}  
• Original attempt date: ${this.formatDate(submission.startedAt)}  
• Request time: ${this.formatDate(new Date().toISOString())}

Next steps
1. Review the request in the Zuvy admin panel.  
2. Approve or decline the re‑attempt.  
3. The student will be notified automatically of your decision.

Need help? Reach out to the Ed‑Ops team on Slack or email [${SUPPORT_EMAIL}].

Thanks,  
Team Zuvy`;
  }

  async requestReattempt(
    assessmentSubmissionId: number,
    userId: number,
  ): Promise<any> {
    try {
      // Check if submission exists and belongs to user
      const submission: any = await db.query.zuvyAssessmentSubmission.findFirst(
        {
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
            user: {
              columns: {
                name: true,
                email: true,
              },
            },
            submitedOutsourseAssessment: {
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
                ModuleAssessment: {
                  columns: {
                    id: true,
                    title: true,
                    description: true,
                    marks: true,
                  },
                },
              },
            },
          },
        },
      );

      if (!submission) {
        return [
          {
            status: 'error',
            statusCode: 404,
            message: 'Assessment submission not found',
          },
        ];
      }
      if (submission.reattempt.length > 0) {
        return [
          {
            status: 'error',
            statusCode: 400,
            message: 'Re-attempt already requested',
          },
        ];
      }
      if (submission.userId !== userId) {
        return [
          {
            status: 'error',
            statusCode: 403,
            message: 'Unauthorized request',
          },
        ];
      }
      let submitedOutsourseAssessment = submission.submitedOutsourseAssessment;
      let ModuleAssessment =
        submission.submitedOutsourseAssessment.ModuleAssessment;
      let user = submission.user;
      // type-safety: userId column is bigint, so cast with BigInt() for the typed eq() helper
      let batch: any = await db.query.zuvyBatchEnrollments.findFirst({
        where: (zuvyBatchEnrollments, { and, eq }) =>
          and(
            eq(zuvyBatchEnrollments.userId, BigInt(userId)),
            eq(
              zuvyBatchEnrollments.bootcampId,
              submitedOutsourseAssessment.bootcampId,
            ),
          ),
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
      let updateReattmpt: any = { reattemptRequested: true };

      await db
        .update(zuvyAssessmentSubmission)
        .set(updateReattmpt)
        .where(eq(zuvyAssessmentSubmission.id, assessmentSubmissionId));
      let reattemptData: any = {
        assessmentSubmissionId,
        userId,
        requestedAt: new Date(),
        status: PENDING,
      };
      await db.insert(zuvyAssessmentReattempt).values(reattemptData);
      // Send email to admin notifying reattempt request
      let [errorAdmin, admin200] = await this.sendEmailToAdmin({
        ...submission,
        ...submitedOutsourseAssessment,
        ...user,
        ...ModuleAssessment,
        batchName: batch.batchInfo.name,
        courseName: batch.bootcamp.name,
      });
      if (errorAdmin) {
        this.logger.error(`error in sending email to admin: ${errorAdmin}`);
        return [
          {
            status: 'success',
            statusCode: 200,
            message: 'Re-attempt approved and Not able to notified',
          },
        ];
      }
      return [
        null,
        {
          status: 'success',
          statusCode: 200,
          message: 'Re-attempt request sent to admin',
        },
      ];
    } catch (error) {
      this.logger.error('Error in requestReattempt:', error);
      return [
        {
          status: 'error',
          statusCode: 500,
          message: error,
        },
      ];
    }
  }

  async getCourseSyllabus(userId: number, bootcampId: number): Promise<any> {
    try {
      // 1. Check if user is enrolled
      const enrollment = await db.query.zuvyBatchEnrollments.findFirst({
        where: (zuvyBatchEnrollments, { and, eq }) =>
          and(
            eq(zuvyBatchEnrollments.userId, BigInt(userId)),
            eq(zuvyBatchEnrollments.bootcampId, bootcampId),
          ),
        with: {
          batchInfo: {
            // capEnrollment & createdAt fetched here so this batchInfo can be reused
            // below instead of issuing a second zuvyBatchEnrollments.findFirst() query
            columns: {
              id: true,
              name: true,
              instructorId: true,
              capEnrollment: true,
              createdAt: true,
            },
            with: {
              instructorDetails: {
                columns: {
                  id: true,
                  name: true,
                  profilePicture: true,
                },
              },
            },
          },
          bootcamp: {
            columns: {
              id: true,
              name: true,
              description: true,
              collaborator: true,
              coverImage: true,
              duration: true,
            },
          },
        },
      });

      if (!enrollment) {
        return [
          {
            status: 'error',
            statusCode: 404,
            message: 'You are not enrolled in this bootcamp',
          },
        ];
      }

      // // 3. Total enrolled students
      // const totalStudents = await db
      //   .select({ count: count() })
      //   .from(zuvyBatchEnrollments)
      //   .where(sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NOT NULL`);

      // 2, 4, 5 & the batch's total-enrolled-students count are all
      // independent of one another, so fetch them concurrently. The
      // students count reuses the batch already resolved via `enrollment`
      // instead of issuing a second zuvyBatchEnrollments.findFirst() query.
      const [
        bootcampLockData,
        modules,
        moduleTrackingData,
        totalEnrolledStudents,
      ] = await Promise.all([
        // 2. Fetch course lock status
        db.query.zuvyBootcampType.findFirst({
          where: (bootcamp, { eq }) => eq(bootcamp.bootcampId, bootcampId),
        }),
        // 4. Fetch course modules and chapters
        db.query.zuvyCourseModules.findMany({
          where: (zuvyCourseModules, { eq }) =>
            eq(zuvyCourseModules.bootcampId, bootcampId),
          columns: {
            id: true,
            name: true,
            description: true,
            order: true,
            timeAlloted: true,
            isLock: true,
          },
          with: {
            moduleChapterData: {
              columns: {
                id: true,
                title: true,
                description: true,
                topicId: true,
                order: true,
                completionDate: true,
              },
              orderBy: (zuvyModuleChapter, { asc }) =>
                asc(zuvyModuleChapter.order),
            },
          },
          orderBy: (zuvyCourseModules, { asc }) => asc(zuvyCourseModules.order),
        }),
        // 5. Fetch module tracking data
        db.query.zuvyModuleTracking.findMany({
          where: (tracking, { eq }) => eq(tracking.userId, userId),
          columns: {
            moduleId: true,
            progress: true,
          },
        }),
        // Total enrolled students in the student's batch
        (enrollment as any).batchInfo.id
          ? db
              .select({ count: count() })
              .from(zuvyBatchEnrollments)
              .where(
                eq(
                  zuvyBatchEnrollments.batchId,
                  (enrollment as any).batchInfo.id,
                ),
              )
              .then((results) => results[0]?.count || 0)
          : Promise.resolve(0),
      ]);

      const isCourseLocked = bootcampLockData?.isModuleLocked || false;

      const moduleProgressMap = new Map(
        moduleTrackingData.map((tracking) => [
          Number(tracking.moduleId),
          tracking.progress,
        ]),
      );

      // 6. Get topic types
      const topicIds = modules
        .flatMap(
          (module) =>
            (module as any).moduleChapterData?.map(
              (chapter: any) => chapter.topicId,
            ) || [],
        )
        .filter((id: any) => id !== null);

      // 7. Get durations for assessments and sessions
      const chapterIds = modules.flatMap(
        (module) =>
          (module as any).moduleChapterData?.map(
            (chapter: any) => chapter.id,
          ) || [],
      );

      const allowedStates = [1, 2, 3]; // PUBLISHED, ACTIVE, CLOSED

      // topicTypes, chapterAssessments & chapterSessions each only depend
      // on `modules` (already resolved above), not on one another.
      const [topicTypes, chapterAssessments, chapterSessions] =
        await Promise.all([
          topicIds.length > 0
            ? db
                .select({
                  id: zuvyModuleTopics.id,
                  name: zuvyModuleTopics.name,
                })
                .from(zuvyModuleTopics)
                .where(inArray(zuvyModuleTopics.id, topicIds))
            : Promise.resolve([]),
          chapterIds.length > 0
            ? db
                .select({
                  chapterId: zuvyOutsourseAssessments.chapterId,
                  timeLimit: zuvyOutsourseAssessments.timeLimit,
                  currentState: zuvyOutsourseAssessments.currentState,
                })
                .from(zuvyOutsourseAssessments)
                .where(inArray(zuvyOutsourseAssessments.chapterId, chapterIds))
            : Promise.resolve([]),
          chapterIds.length > 0
            ? db
                .select({
                  chapterId: zuvySessions.chapterId,
                  startTime: zuvySessions.startTime,
                  endTime: zuvySessions.endTime,
                })
                .from(zuvySessions)
                .where(inArray(zuvySessions.chapterId, chapterIds))
            : Promise.resolve([]),
        ]);

      const topicMap = new Map(
        topicTypes.map((topic) => [topic.id, topic.name]),
      );

      const assessmentStateMap = new Map<number, number>();
      chapterAssessments.forEach((assessment) => {
        if (
          assessment.chapterId !== null &&
          assessment.chapterId !== undefined
        ) {
          assessmentStateMap.set(assessment.chapterId, assessment.currentState);
        }
      });

      const chapterDurationMap = new Map(
        chapterAssessments
          .filter(
            (assessment) =>
              assessment.currentState !== null &&
              allowedStates.includes(assessment.currentState),
          )
          .map((assessment) => [
            assessment.chapterId,
            assessment.timeLimit ? Math.round(assessment.timeLimit / 60) : null,
          ]),
      );

      chapterSessions.forEach((session) => {
        if (session.startTime && session.endTime) {
          const startTime = new Date(session.startTime);
          const endTime = new Date(session.endTime);
          const durationMinutes = Math.round(
            (endTime.getTime() - startTime.getTime()) / (1000 * 60),
          );

          if (
            !chapterDurationMap.has(session.chapterId) &&
            durationMinutes > 0
          ) {
            chapterDurationMap.set(session.chapterId, durationMinutes);
          }
        }
      });

      // 8. Format modules with progress
      let formattedModules = modules.map((module, index) => {
        const progress = moduleProgressMap.get(module.id) || 0;

        return {
          moduleId: Number(module.id),
          moduleName: module.name,
          moduleDescription: module.description,
          isLock: module.isLock, // will override later
          progress,
          moduleDuration: module.timeAlloted
            ? `${Math.round(module.timeAlloted / 60)} min`
            : 'Not specified',
          chapters: ((module as any).moduleChapterData || [])
            .filter((chapter: any) => {
              const state = assessmentStateMap.get(chapter.id);
              return state === undefined || allowedStates.includes(state);
            })
            .map((chapter: any) => {
              const duration = chapterDurationMap.get(chapter.id);
              let chapterDuration = 'Self-paced';

              if (duration) {
                chapterDuration = `${duration} min`;
              } else if (chapter.completionDate) {
                chapterDuration = 'Timed';
              }

              return {
                chapterId: Number(chapter.id),
                chapterName: chapter.title,
                chapterDescription: chapter.description,
                chapterType: chapter.topicId
                  ? topicMap.get(chapter.topicId) || 'Unknown'
                  : 'Unknown',
                chapterDuration,
                chapterOrder: chapter.order,
              };
            }),
        };
      });

      // 9. Locking logic
      if (!isCourseLocked) {
        formattedModules = formattedModules.map((module) => ({
          ...module,
          isLock: false,
        }));
      } else {
        let lastStartedOrCompletedIndex = -1;

        for (let i = formattedModules.length - 1; i >= 0; i--) {
          if (formattedModules[i].progress > 0) {
            lastStartedOrCompletedIndex = i;
            break;
          }
        }

        if (lastStartedOrCompletedIndex === -1) {
          formattedModules = formattedModules.map((module, index) => ({
            ...module,
            isLock: index !== 0,
          }));
        } else {
          const isLastCompleted =
            formattedModules[lastStartedOrCompletedIndex].progress === 100;

          formattedModules = formattedModules.map((module, index) => {
            if (index <= lastStartedOrCompletedIndex)
              return { ...module, isLock: false };
            if (isLastCompleted && index === lastStartedOrCompletedIndex + 1)
              return { ...module, isLock: false };
            return { ...module, isLock: true };
          });
        }
      }

      // 10. Final syllabus response
      const syllabus = {
        bootcampId: Number((enrollment as any).bootcamp?.id || bootcampId),
        bootcampName: (enrollment as any).bootcamp?.name || 'Unknown Bootcamp',
        bootcampDescription: (enrollment as any).bootcamp?.description || '',
        collaboratorName: (enrollment as any).bootcamp?.collaborator || '',
        courseDuration: (enrollment as any).bootcamp?.duration || '',
        coverImage: (enrollment as any).bootcamp?.coverImage || '',
        totalStudentsInCourse: totalEnrolledStudents || 0,
        studentBatchId: (enrollment as any).batchInfo?.id
          ? Number((enrollment as any).batchInfo.id)
          : null,
        studentBatchName: (enrollment as any).batchInfo?.name || 'Not Assigned',
        instructorName:
          (enrollment as any).batchInfo?.instructorDetails?.name ||
          'Not Assigned',
        instructorProfilePicture: (enrollment as any).batchInfo
          ?.instructorDetails?.profilePicture,
        modules: formattedModules.map(({ progress, ...mod }) => mod), // remove progress before returning
      };

      return [
        null,
        {
          status: 'success',
          statusCode: STATUS_CODES.OK,
          message: 'Course syllabus fetched successfully',
          data: syllabus,
        },
      ];
    } catch (error) {
      this.logger.error('Error in getCourseSyllabus:', error);
      return [
        {
          status: 'error',
          statusCode: STATUS_CODES.BAD_REQUEST,
          message: error.message,
        },
      ];
    }
  }
}
