import { Injectable, Logger } from '@nestjs/common';
const AWS = require('aws-sdk');
import { db } from '../../db/index';
import { eq, sql, count, lte, inArray, and } from 'drizzle-orm';
import * as _ from 'lodash';
import { zuvyBatchEnrollments, zuvyAssessmentSubmission, zuvyChapterTracking, zuvyOpenEndedQuestionSubmission, zuvyProjectTracking, zuvyQuizTracking, zuvyModuleChapter, zuvyFormTracking, zuvyPracticeCode,zuvyOutsourseQuizzes, zuvyModuleQuizVariants, zuvyOutsourseAssessments } from '../../../drizzle/schema';
import { InstructorFeedbackDto, PatchOpenendedQuestionDto, CreateOpenendedQuestionDto } from './dto/submission.dto';
import { STATUS_CODES } from 'src/helpers';
import { helperVariable } from 'src/constants/helper';
const fs = require('fs');
const path = require('path');
const DIFFICULTY = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
};
// Difficulty Points Mapping
let { ACCEPTED, SUBMIT } = helperVariable;
const { SUPPORT_EMAIL, AWS_SUPPORT_ACCESS_SECRET_KEY, AWS_SUPPORT_ACCESS_KEY_ID, ZUVY_BASH_URL} = process.env; // Importing env values


@Injectable()
export class SubmissionService {
  private readonly logger = new Logger(SubmissionService.name);
  /**
   * Appends a score update record to the CSV log with a dynamic message.
   */
  private async addScoreUpdateToCsvLog({ userId, oldMarks, newMarks, submitData, mergedData, calcResult }) {
    try {
      const logFilePath = path.join(process.cwd(), 'updated_marks_log3.json');
      this.logger.log(`[LOG DEBUG] Writing score update to: ${logFilePath}`);

      // Fetch user details from DB
      let userName = '';
      let userEmail = '';
      try {
        const user = await db.query.users.findFirst({
          where: (zuvyUser, { eq }) => eq(zuvyUser.id, userId),
          columns: { name: true, email: true }
        });
        if (user) {
          userName = user.name;
          userEmail = user.email;
        }
      } catch (userErr) {
        this.logger.error(`[LOG ERROR] Could not fetch user details for userId ${userId}:`, userErr);
      }

      // Determine what was corrected
      let messageParts = [];
      if (submitData.mcqScore !== undefined && mergedData.mcqScore !== undefined && submitData.mcqScore != mergedData.mcqScore) {
        messageParts.push('MCQ correction: Some multiple-choice questions had incorrect options marked as correct.');
      }
      if (submitData.codingScore !== undefined && mergedData.codingScore !== undefined && submitData.codingScore != mergedData.codingScore) {
        messageParts.push('Coding submission correction: Some coding submissions were re-evaluated or updated.');
      }
      let detailedMessage = '';
      if (messageParts.length > 0) {
        detailedMessage = 'Marks updated due to: ' + messageParts.join(' ');
      } else {
        detailedMessage = 'Marks updated due to assessment correction.';
      }
      detailedMessage += ' The score has been recalculated and updated as per the correct answers and latest submissions.';

      const logEntry = {
        userId,
        userName,
        userEmail,
        oldMarks,
        newMarks,
        oldMcqScore: submitData.mcqScore ?? null,
        oldCodingScore: submitData.codingScore ?? null,
        mcqScore: mergedData.mcqScore,
        codingScore: mergedData.codingScore,
        message: detailedMessage,
        timestamp: new Date().toISOString()
      };

      // Read existing log data (array of objects)
      let logArray = [];
      if (fs.existsSync(logFilePath)) {
        try {
          const fileContent = fs.readFileSync(logFilePath, 'utf8').trim();
          if (fileContent) {
            // Support both old line-delimited JSON and array format
            if (fileContent.startsWith('[')) {
              logArray = JSON.parse(fileContent);
            } else {
              logArray = fileContent.split('\n').filter(Boolean).map(line => JSON.parse(line));
            }
          }
        } catch (readErr) {
          this.logger.error(`[LOG ERROR] Failed to read log file at ${logFilePath}:`, readErr);
        }
      }
      logArray.push(logEntry);
      try {
        fs.writeFileSync(logFilePath, JSON.stringify(logArray, null, 2), 'utf8');
        this.logger.log(`Score update logged for user ${userId}: ${detailedMessage}`);
      } catch (fileErr) {
        this.logger.error(`[LOG ERROR] Failed to write to log file at ${logFilePath}:`, fileErr);
        throw new Error('Failed to log score update to JSON');
      }
    } catch (error) {
      this.logger.error('[LOG ERROR] Error in addScoreUpdateToCsvLog:', error);
      throw new Error('Failed to log score update to JSON');
    }
  }

  async getSubmissionOfPractiseProblem(bootcampId: number, searchProblem: string) {
    try {
      const topicId = 3;

      // Query to fetch module and chapter details along with coding question details
      const trackingData = await db.query.zuvyCourseModules.findMany({
        where: (courseModules, { eq, and }) =>
          and(eq(courseModules.bootcampId, bootcampId)),
        orderBy: (courseModules, { asc }) => asc(courseModules.order),
        with: {
          moduleChapterData: {
            columns: {
              id: true,
            },
            where: (moduleChapter, { eq, and, sql }) =>
              and(
                eq(moduleChapter.topicId, topicId),
                searchProblem
                  ? sql`
                    EXISTS (
                      SELECT 1
                      FROM main.zuvy_coding_questions AS cq
                      WHERE cq.id = ${moduleChapter.codingQuestions}
                      AND cq.title ILIKE ${searchProblem + '%'}
                    )
                  `
                  : sql`TRUE`
              ),
            with: {
              chapterTrackingDetails: {
                columns: {
                  userId: true,
                },
              },
              codingQuestionDetails: {
                columns: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      });

      // Query to get the count of total students enrolled in the bootcamp
      const zuvyBatchEnrollmentsCount = await db
        .select({
          count: sql<number>`cast(count(${zuvyBatchEnrollments.id}) as int)`,
        })
        .from(zuvyBatchEnrollments)
        .where(sql`${zuvyBatchEnrollments.bootcampId} = ${bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NOT NULL`);

      // Processing tracking data to add `submitStudents` field
      trackingData.forEach((course: any) => {
        course.moduleChapterData.forEach((chapterTracking) => {
          chapterTracking['submitStudents'] = chapterTracking['chapterTrackingDetails'].length;
          delete chapterTracking['chapterTrackingDetails'];
        });
      });

      // Check if data exists and return result
      if (!trackingData || trackingData.length === 0) {
        return [];
      }

      const totalStudents = zuvyBatchEnrollmentsCount[0]?.count || 0;

      return {
        trackingData: trackingData.filter((course: any) => course.moduleChapterData.length > 0),
        totalStudents: totalStudents,
      };

    } catch (err) {
      throw err;
    }
  }

  async practiseProblemStatusOfStudents(
    questionId: number,
    chapterId: number,
    moduleId: number,
    limit: number,
    offset: number,
    searchStudent: string
  ) {
    try {
      const statusOfStudentCode = await db.query.zuvyChapterTracking.findMany({
        where: (chapterTracking, { sql }) =>
          sql`${chapterTracking.chapterId} = ${chapterId} AND ${chapterTracking.moduleId} = ${moduleId}`,
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
            where: (user, { sql }) =>
              searchStudent
                ? sql`(${user.name} ILIKE ${searchStudent + '%'} OR ${user.email} ILIKE ${searchStudent + '%'})`
                : sql`TRUE`,
            with: {
              studentCodeDetails: {
                where: (practiceCode, { sql }) =>
                  sql`${practiceCode.action} = 'submit' AND ${practiceCode.submissionId} IS NULL`,
              },
            },
          },
        },
        limit: limit,
        offset: offset,
      });

      // Get the total number of students matching the chapter and module criteria
      const totalStudents = await db
        .select()
        .from(zuvyChapterTracking)
        .where(
          sql`${zuvyChapterTracking.moduleId} = ${moduleId} and ${zuvyChapterTracking.chapterId} = ${chapterId}`
        );

      const totalStudentsCount = totalStudents.length;
      const totalPages = Math.ceil(totalStudentsCount / limit);

      // Prepare the result with data about each student's attempts and submission status
      const data = statusOfStudentCode.map((statusCode) => {
        const user = statusCode['user'];

        // Check if user exists before accessing properties
        if (user) {
          return {
            id: Number(user['id']),
            name: user['name'],
            emailId: user['email'],
            noOfAttempts: user['studentCodeDetails']?.length,
            status: user['studentCodeDetails']?.some(
              (submission) => submission.status === 'Accepted'
            )
              ? 'Accepted'
              : 'Not Accepted',
          };
        } else {
          return null;
        }
      }).filter((item) => item !== null);

      return { data, totalPages, totalStudentsCount };
    } catch (err) {
      throw err;
    }
  }

  async getAssessmentInfoBy(bootcamp_id, limit: number, offset: number) {
    try {
      const statusOfStudentCode = await db.query.zuvyCourseModules.findMany({
        where: (zuvyCourseModules, { sql }) =>
          sql`${zuvyCourseModules.bootcampId} = ${bootcamp_id}`,
        with: {
          moduleAssessments: {
            columns: {
              moduleId: true,
              title: true,
              codingProblems: true,
              mcq: true,
              openEndedQuestions: true,
              id: true
            },
            with: {
              assessmentSubmissions: {
                where: (zuvyAssessmentSubmission, { sql }) =>
                  sql`${zuvyAssessmentSubmission.bootcampId} = ${bootcamp_id}`,
                columns: {
                  userId: true,
                  assessmentId: true
                },
              },
            },
          },
        },
        limit: limit,
        offset: offset,
      });

      let bootcampStudents = await db.select().from(zuvyBatchEnrollments).where(sql` ${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} AND${zuvyBatchEnrollments.batchId} IS NOT NULL  `)

      return { data: statusOfStudentCode, totalstudents: bootcampStudents.length };
    } catch (error) {
      console.error('Error fetching assessment info:', error);
      throw error;
    }
  }

  async formatedChapterDetails(chapterDetails: any) {
    try {
      chapterDetails.Quizzes = chapterDetails?.Quizzes.map((Quizzes) => {
        let quizDetails = { ...Quizzes.Quiz, }
        delete Quizzes.Quiz
        return { ...Quizzes, ...quizDetails }
      })

      chapterDetails.OpenEndedQuestions = chapterDetails?.OpenEndedQuestions.map((OpenEndedQuestions) => {
        let openEndedDetails = { ...OpenEndedQuestions.OpenEndedQuestion, }
        delete OpenEndedQuestions.OpenEndedQuestion
        return { ...OpenEndedQuestions, ...openEndedDetails }
      })

      chapterDetails.CodingQuestions = chapterDetails?.CodingQuestions.map((CodingQuestions) => {
        let codingDetails = { ...CodingQuestions.CodingQuestion, }
        delete CodingQuestions.CodingQuestion
        return { ...CodingQuestions, ...codingDetails }
      })

      return chapterDetails
    } catch (err) {
      throw err;
    }
  }

  async calculateTotalPoints(data: any) {
    let {hardCodingMark, mediumCodingMark, easyCodingMark } = data
    const CODING_POINTS = { easy: easyCodingMark, medium: mediumCodingMark, hard: hardCodingMark };
    // const totalOpenPoints = data.OpenEndedQuestions.reduce((sum, q) => sum + pointsMapping.OPEN_ENDED_POINTS[q.difficulty], 0);
    const totalCodingPoints = data.CodingQuestions.reduce((sum, q) => sum + CODING_POINTS[q.difficulty], 0);

    let codingQuestionCount = data.CodingQuestions.length;
    let mcqQuestionCount = data.Quizzes.length;
    let openEndedQuestionCount = data.OpenEndedQuestions.length;
    let {hardMcqMark, mediumMcqMark, easyMcqMark, hardMcqQuestions, mediumMcqQuestions, easyMcqQuestions} = data;
    let totalMCQPoints = (hardMcqMark * hardMcqQuestions ) + (mediumMcqMark * mediumMcqQuestions) + (easyMcqMark * easyMcqQuestions);
    const totalPoints = totalMCQPoints + totalCodingPoints;

    return { totalMCQPoints, totalCodingPoints, totalPoints, codingQuestionCount, mcqQuestionCount, openEndedQuestionCount };
  }


  async calculateAssessmentResults(assessmentOutsourseId: number, practiceCodeData, mcqScore) {
    try {
      let assessment:any = (await db.select().from(zuvyOutsourseAssessments).where(eq(zuvyOutsourseAssessments.id, assessmentOutsourseId)))

      if (assessment == undefined || assessment.length == 0) {
        return [{
          status: 'error',
          statusCode: 404,
          message: 'Assessment not found',
        }];
      }
      assessment = assessment[0];
      let codingMarks = {
        Easy: assessment.easyCodingMark,
        Medium: assessment.mediumCodingMark,
        Hard: assessment.hardCodingMark,
      }
      // Only count the latest submission per questionId
      const latestCodingSubmissions = Object.values(
        (practiceCodeData || []).reduce((acc, curr) => {
          const qid = curr.questionId;
          if (!acc[qid] || new Date(curr.createdAt || 0) > new Date(acc[qid]?.createdAt || 0)) {
            acc[qid] = curr;
          }
          return acc;
        }, {})
      );
      let codingScore = 0;
      latestCodingSubmissions.forEach((codingQuestionSubmission: any) => {
        codingScore += codingMarks[codingQuestionSubmission.questionDetail.difficulty];
      });
      const totalCodingMarks = 
        (assessment.easyCodingQuestions * assessment.easyCodingMark) +
        (assessment.mediumCodingQuestions * assessment.mediumCodingMark) +
        (assessment.hardCodingQuestions * assessment.hardCodingMark);

      // Calculate total possible score for MCQs
      const totalMcqMarks = 
          (assessment.easyMcqQuestions * assessment.easyMcqMark) +
          (assessment.mediumMcqQuestions * assessment.mediumMcqMark) +
          (assessment.hardMcqQuestions * assessment.hardMcqMark);
      // Total assessment score
      let totalStudentScore = codingScore + mcqScore
      const totalAssessmentMarks = totalCodingMarks + totalMcqMarks;
      let percentage = (totalStudentScore / totalAssessmentMarks ) * 100
      percentage = percentage ? percentage : 0;
      let isPassed = (assessment.passPercentage <= percentage) ? true: false
      let updateAssessmentSubmission = {
        attemptedCodingQuestions: latestCodingSubmissions.length,
        codingScore: parseFloat(codingScore.toFixed(2)),
        marks:parseFloat(totalStudentScore.toFixed(2)),
        isPassed,
        percentage:parseFloat(percentage.toFixed(2))
      }
      return [null, updateAssessmentSubmission];
    } catch (err) {
      return [{message: err.message}]
    }
  }

  async getAssessmentSubmission(assessmentSubmissionId: number, userId: number) {
    try {
      const data: any = await db.query.zuvyAssessmentSubmission.findFirst({
        where: (zuvyAssessmentSubmission, { eq }) =>
          eq(zuvyAssessmentSubmission.id, assessmentSubmissionId),
        with: {
          user: {
            columns: {
              email: true,
              name: true,
              id: true
            }
          },
          submitedOutsourseAssessment: true,
          PracticeCode: {
            where: (zuvyPracticeCode, { eq, and }) => and(
              eq(zuvyPracticeCode.status, ACCEPTED),
              eq(zuvyPracticeCode.action, SUBMIT),
              eq(zuvyPracticeCode.userId, userId),
            ),
            distinct: [zuvyPracticeCode.questionId],
            with: {
              questionDetail: true
            },
          }
        }
      });
      if (data == undefined || data.length == 0) {
        return [{
          status: 'error',
          statusCode: 404,
          message: 'Assessment not found',
        }];
      }
      // Only return the fetched data, do not calculate results here
      // The calculation will be handled in assessmentSubmission
      return [null, {
        userId: data.user.id,
        submitedAt: data.submitedAt,
        assessmentOutsourseId: data.assessmentOutsourseId,
        PracticeCode: data.PracticeCode,
        mcqScore: data.mcqScore,
        marks: data.marks,
        isPassed: data.isPassed,
        codingScore: data.codingScore,
        // Add any other fields needed by assessmentSubmission
      }];
    } catch (err) {
      return [{ message: err.message }];
    }
  }


  async assessmentSubmission(data, id: number, userId: number): Promise<any> {
    try {
      let err: any, submitData:any;
      // Step 1: Fetch assessment submission details for the user and submission id
      [err, submitData] = await this.getAssessmentSubmission(id, userId);
      if (err) {
        // If there is an error in fetching, return immediately
        return [err];
      }

      // Step 2: Validate the fetched data
      if (!submitData) {
        return [{
          status: 'error',
          statusCode: 404,
          message: 'Assessment not found',
        }];
      }
      if (submitData.userId != userId) {
        return [{
          status: 'error',
          statusCode: 400,
          message: 'Unauthorized assessment submission',
        }];
      }
      // // Only check submitedAt if it exists on submitData
      // if ('submitedAt' in submitData && submitData.submitedAt != null) {
      //   return [{
      //     status: 'error',
      //     statusCode: 400,
      //     message: 'Assessment already submitted',
      //   }];
      // }

      // Step 3: Calculate assessment results before updating
      // Use the same logic as getAssessmentSubmission, but call directly here
      const [errCalc, calcResult] = await this.calculateAssessmentResults(
        submitData.assessmentOutsourseId,
        submitData.PracticeCode,
        submitData.mcqScore
      );
      if (errCalc) {
        return [errCalc];
      }

      // Step 4: Merge input data, fetched submission data, and calculated results
      // Ensure all relevant fields from getAssessmentSubmission are included in the return
      const mergedData = {
        ...data,
        ...calcResult,
        userId: submitData.userId,
        submitedAt: submitData.submitedAt,
        assessmentOutsourseId: submitData.assessmentOutsourseId,
        mcqScore: Number(parseFloat(submitData.mcqScore).toFixed(2)),
      };
      // Log to CSV if marks changed
      if (submitData.marks != mergedData.marks) {
        console.log("submitData.marks", submitData.marks, "\n mergedData.marks", mergedData.marks);
        this.logger.log(`User ${userId} updated marks from ${submitData.marks} to ${mergedData.marks}`);
        await this.addScoreUpdateToCsvLog({
          userId,
          oldMarks: submitData.marks,
          newMarks: mergedData.marks,
          submitData,
          mergedData,
          calcResult
        });
      }

      // Optional: log the merged data for debugging
      // console.log('data', mergedData);

      // Step 5: Update the assessment submission in the database
      // const assessment = await db.update(zuvyAssessmentSubmission).set(mergedData).where(eq(zuvyAssessmentSubmission.id, id)).returning();
      // if (!assessment || assessment.length === 0) {
      //   return [{
      //     status: 'error',
      //     statusCode: 404,
      //     message: 'Assessment not found',
      //   }];
      // }
      // // Step 6: Return the updated assessment
      // console.log('Merged Data:', mergedData);
      return [null, mergedData];
    } catch (err) {
      // Log and return error in case of failure
      console.error('Error in assessmentSubmission:', err);
      return [{ message: err.message }];
    }
  }

  async submissionOpenended(OpenendedQuestionData: CreateOpenendedQuestionDto, userId: number) {
    try {
      const OpenendedQuestionSubmission = await db.insert(zuvyOpenEndedQuestionSubmission).values({ ...OpenendedQuestionData, userId }).returning();
      return OpenendedQuestionSubmission;
    } catch (err) {
      throw err;
    }
  }

  async patchOpenendedQuestion(data: any, id: number) {
    try {
      const res = await db.update(zuvyOpenEndedQuestionSubmission).set(data).where(eq(zuvyOpenEndedQuestionSubmission.id, id)).returning();
      return res;
    } catch (err) {
      throw err;
    }
  }

  async instructorFeedback(data: any, id: number) {
    try {
      const res = await db.update(zuvyOpenEndedQuestionSubmission).set(data).where(eq(zuvyOpenEndedQuestionSubmission.id, id)).returning();
      return res;
    } catch (err) {
      throw err;
    }
  }

  async getOpenendedQuestionSubmission(submer_assissment_id) {
    try {
      const res = await db.query.zuvyOpenEndedQuestionSubmission.findMany({
        where: (zuvyOpenEndedQuestionSubmission, { eq }) => eq(zuvyOpenEndedQuestionSubmission.id, submer_assissment_id),
        with: {
          user: {
            columns: {
              name: true,
              email: true,
            },
          },
          openEnded: {
            columns: {
              id: true,
              question: true,
              difficulty: true,
            },
          },
        }
      })
      return res;
    } catch (err) {
      throw err;
    }
  }

  async getAllProjectSubmissions(bootcampId: number, searchProject: string) {
    try {
      const data = await db.query.zuvyBootcamps.findFirst({
        columns: {
          id: true,
          name: true,
        },
        where: (bootcamp, { eq }) => eq(bootcamp.id, bootcampId),
        with: {
          bootcampModules: {
            columns: {
              id: true,
            },
            where: (courseModule, { sql }) =>
              sql`${courseModule.typeId} = 2`,
            orderBy: (courseModule, { asc }) => asc(courseModule.order),
            with: {
              projectData: {
                columns: {
                  id: true,
                  title: true,
                },
                where: (projectData, { sql }) =>
                  searchProject
                    ? sql`${projectData.title} ILIKE ${searchProject + '%'}`
                    : sql`TRUE`,
                with: {
                  projectTrackingData: true,
                },
              },
            },
          },
        },
      });

      const zuvyBatchEnrollmentsCount = await db
        .select({
          count: sql<number>`cast(count(${zuvyBatchEnrollments.id}) as int)`,
        })
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId));

      // Filter and process project data
      data['bootcampModules'].forEach((module: any) => {
        module.projectData.forEach((project: any) => {
          project['submitStudents'] = project['projectTrackingData'].length;
          delete project['projectTrackingData'];
        });
      });

      // Filter out modules where projectData is empty
      data['bootcampModules'] = data['bootcampModules'].filter(
        (module: any) => module.projectData.length > 0
      );

      // Check if there are any modules left and return response
      if (data['bootcampModules'].length > 0) {
        return {
          status: 'success',
          code: 200,
          data,
          totalStudents: zuvyBatchEnrollmentsCount[0]?.count,
        };
      } else {
        return {
          status: 'error',
          code: 404,
          message: 'No project in this course.',
        };
      }
    } catch (err) {
      throw err;
    }
  }

  async getUserDetailsForProject(
    projectId: number,
    bootcampId: number,
    limit: number,
    offset: number,
    searchStudent: string
  ) {
    try {
      const projectSubmissionData = await db.query.zuvyCourseProjects.findFirst({
        where: (zuvyProject, { sql }) => sql`${zuvyProject.id} = ${projectId}`,
        columns: {
          id: true,
          title: true,
        },
        with: {
          projectTrackingData: {
            where: (projectTracking, { and, eq, sql }) =>
              and(
                eq(projectTracking.bootcampId, bootcampId),
                sql`TRUE` // Filter for additional conditions if needed
              ),
            columns: {
              id: true,
              userId: true,
              projectId: true,
              bootcampId: true,
              isChecked: true,
              moduleId: true,
            },
            with: {
              userDetails: {
                columns: {
                  name: true,
                  email: true,
                },
                where: (userDetails, { sql }) =>
                  searchStudent

                    ? sql`${userDetails.name} ILIKE ${searchStudent + '%'} OR ${userDetails.email} ILIKE ${searchStudent + '%'}`
                    : sql`TRUE`, // If no search string is provided, return all records
              },
            },
            limit: limit,
            offset: offset,
          },
        },
      });

      // Get total count of students for pagination
      const totalStudentsCount = await db
        .select()
        .from(zuvyProjectTracking)
        .where(
          sql`${zuvyProjectTracking.projectId} = ${projectId} and ${zuvyProjectTracking.bootcampId} = ${bootcampId}`
        );

      const totalPages = Math.ceil(totalStudentsCount.length / limit);

      // Process the project submission data
      if (projectSubmissionData['projectTrackingData'].length > 0) {
        projectSubmissionData['projectTrackingData'].forEach((project: any) => {
          project['userName'] = project['userDetails']['name'];
          project['userEmail'] = project['userDetails']['email'];
          delete project['userDetails'];
        });

        return {
          status: 'success',
          code: 200,
          projectSubmissionData,
          totalPages: limit > 0 ? totalPages : 1,
          totalStudents: totalStudentsCount.length,
        };
      } else {
        return {
          status: 'error',
          code: 404,
          message: 'No submission from any student for this project',
        };
      }
    } catch (err) {
      throw err;
    }
  }

  async getProjectDetailsForAUser(projectId: number, userId: number, bootcampId: number) {
    try {
      const projectSubmissionDetails = await db.query.zuvyCourseProjects.findFirst({
        where: (zuvyProject, { sql }) => sql`${zuvyProject.id} = ${projectId}`,
        with: {
          projectTrackingData: {
            where: (projectTracking, { sql }) => sql`${projectTracking.bootcampId} = ${bootcampId} and ${projectTracking.userId} = ${userId}`,
            with: {
              userDetails: {
                columns: {
                  name: true,
                  email: true,
                }
              },
            }
          }
        }
      });
      return {
        status: 'success',
        code: 200,
        projectSubmissionDetails
      }
    } catch (err) {
      throw err;
    }
  }
  
  // submission of the quizzez , and open ended questions, And  two different functons
  async submitQuiz(answers, userId, assessmentSubmissionId, assessmentOutsourseId): Promise<any> {
    try {
      // Fetch required data
      const [submissionData, AssessmentsMasterData] = await Promise.all([
        this.getSubmissionQuiz(assessmentSubmissionId, userId),
        db.select().from(zuvyOutsourseAssessments).where(eq(zuvyOutsourseAssessments.id, assessmentOutsourseId))
      ]);
  
      if (!AssessmentsMasterData.length) {
        return [{ message: 'Outsourse assessment not found' }];
      }
  
      const mcqMarks = {
        Easy: AssessmentsMasterData[0].easyMcqMark,
        Medium: AssessmentsMasterData[0].mediumMcqMark,
        Hard: AssessmentsMasterData[0].hardMcqMark
      };
  
      const filterQuestionIds = submissionData.map((answer) => answer.variantId);
      const filterAnswersQuestionIds = answers.map((answer) => answer.variantId);
      let mcqScore = 0;
      let requiredMCQScore = 0;
  
      // Fetch quiz master data if applicable
      const quizMasterData = await db.query.zuvyModuleQuizVariants.findMany({
            where: (zuvyModuleQuizVariants, { sql }) => sql`${zuvyModuleQuizVariants.id} in ${[...filterQuestionIds,...filterAnswersQuestionIds]}`,
            with: {
              quiz: {
                columns: { difficulty: true, id: true }
              }
            }
          })
  
      quizMasterData.forEach((data:any) => {
        requiredMCQScore += mcqMarks[data.quiz.difficulty];
      });

      const insertData = [];
      const updatePromises = [];
  
      answers.forEach((answer) => {
        answer.status = 'failed';
        answer.assessmentSubmissionId = assessmentSubmissionId;

        const matchingQuiz:any = quizMasterData.find(
          (mcq) => mcq.id === answer.variantId && answer.chosenOption === mcq.correctOption
        );
  
        if (matchingQuiz) {
          mcqScore += mcqMarks[matchingQuiz.quiz.difficulty];
          answer.status = 'passed';
        }
        if (filterQuestionIds.includes(answer.variantId)) {
          // Collect update promises
          updatePromises.push(
            db
              .update(zuvyQuizTracking)
              .set({ ...answer })
              .where(
                sql`${zuvyQuizTracking.questionId} = ${answer.questionId} 
                AND ${zuvyQuizTracking.assessmentSubmissionId} = ${assessmentSubmissionId} 
                AND ${zuvyQuizTracking.userId} = ${userId}`
              )
              .returning()
          );
        } else {
          // Collect insert data
          insertData.push({ ...answer, userId, assessmentSubmissionId });
        }
      });
  
      // Execute updates in parallel
      const updateResults = updatePromises.length > 0 ? await Promise.all(updatePromises) : [];
  
      // Insert new data if available
      const insertedData = insertData.length > 0
        ? await db.insert(zuvyQuizTracking).values(insertData).returning()
        : [];
  
      // Update assessment MCQ info
      const updateAssessmentMcqInfo:any = {
        mcqScore,
        requiredMCQScore,
        attemptedMCQQuestions: answers.length
      };
  
      await db
        .update(zuvyAssessmentSubmission)
        .set(updateAssessmentMcqInfo)
        .where(sql`${zuvyAssessmentSubmission.id} = ${assessmentSubmissionId}`)
        .returning();
  
      // Return combined data
      return [
        null,
        {
          message: 'Successfully saved the Quiz.',
          data: [...insertedData, ...updateResults.flat()]
        }
      ];
    } catch (err) {
      return [{ message: err.message }];
    }
  }
  

  async getSubmissionQuiz(assessmentSubmissionId, userId: number) {
    try {
      const submissionQuiz = await db.select().from(zuvyQuizTracking).where(sql`${zuvyQuizTracking.assessmentSubmissionId} = ${assessmentSubmissionId} and ${zuvyQuizTracking.userId} = ${userId}`);
      return submissionQuiz;
    } catch (err) {
      throw err;
    }
  }

  async submitOpenEndedQuestion(answers, userId, assessmentSubmissionId) {
    try {
      let updateData = [];
      let insertData = [];
      let submissionData = await this.getSubmissionOpenEnded(assessmentSubmissionId, userId);
      let updateResults = []; // Declare the updateResults variable

      if (submissionData.length > 0) {
        let filterQuestionId = submissionData.map((answer) => answer.questionId);
        let updatePromises = [];
        let insertPromises = [];

        for (let answer of answers) {
          if (filterQuestionId.includes(answer.questionId)) {
            let updatePromise = db.update(zuvyOpenEndedQuestionSubmission)
              .set({ ...answer })
              .where(sql`${zuvyOpenEndedQuestionSubmission.questionId} = ${answer.questionId} and ${zuvyOpenEndedQuestionSubmission.userId} = ${userId} and ${zuvyOpenEndedQuestionSubmission.assessmentSubmissionId} = ${assessmentSubmissionId}`)
              .returning();
            updatePromises.push(updatePromise);
          } else {
            insertData.push({ ...answer, userId, assessmentSubmissionId });
          }
        }

        // Await all update promises
        if (updatePromises.length > 0) {
          let updateResults = await Promise.all(updatePromises);
          updateResults.forEach(result => {
            updateData.push(result[0]);
          });
        }

        // Insert new answers if any
        if (insertData.length > 0) {
          const insertResults = await db.insert(zuvyOpenEndedQuestionSubmission).values(insertData).returning();
          insertData = insertResults;
        }
      } else {
        let quizInsertData = answers.map((answer) => ({ ...answer, userId, assessmentSubmissionId }));
        insertData = await db.insert(zuvyOpenEndedQuestionSubmission).values(quizInsertData).returning();
      }
      return { message: "Successfully save the open ended question.", data: [...insertData, ...updateData] };
    } catch (err) {
      console.error('Error in submitOpenEndedQuestion:', err);
      throw err; // Ensure proper error handling/logging here
    }
  }


  async getSubmissionOpenEnded(assessmentSubmissionId, userId: number) {
    try {
      const submissionOpenEnded = await db.select().from(zuvyOpenEndedQuestionSubmission).where(sql`${zuvyOpenEndedQuestionSubmission.assessmentSubmissionId} = ${assessmentSubmissionId} and ${zuvyOpenEndedQuestionSubmission.userId} = ${userId}`);
      return submissionOpenEnded;
    } catch (err) {
      throw err;
    }
  }

  async getSubmissionOfForms(bootcampId: number) {
    try {
      const topicId = 7;
      const trackingData = await db.query.zuvyCourseModules.findMany({
        where: (courseModules, { eq }) =>
          eq(courseModules.bootcampId, bootcampId),
        orderBy: (courseModules, { asc }) => asc(courseModules.order),
        with: {
          moduleChapterData: {
            columns: {
              id: true,
              title: true,
            },
            where: (moduleChapter, { eq }) =>
              eq(moduleChapter.topicId, topicId),
            with: {
              chapterTrackingDetails: {
                columns: {
                  userId: true,
                },
              },
            },
          },
        }
      });

      const zuvyBatchEnrollmentsCount = await db
        .select({
          count: sql<number>`cast(count(${zuvyBatchEnrollments.id}) as int)`,
        })
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId));


      const filteredTrackingData = trackingData.filter((course: any) => course.moduleChapterData.length > 0);

      filteredTrackingData.forEach((course: any) => {
        course.moduleChapterData.forEach((chapterTracking) => {
          chapterTracking['submitStudents'] =
            chapterTracking['chapterTrackingDetails'].length;
          delete chapterTracking['chapterTrackingDetails'];
        });
      });

      if (filteredTrackingData.length > 0) {
        return {
          status: 'success',
          code: 200,
          trackingData: filteredTrackingData,
          totalStudents: zuvyBatchEnrollmentsCount[0]?.count,
        }
      }
      else {
        return {
          status: 'error',
          code: 404,
          message: 'No forms in this course.'
        }
      }

    } catch (err) {
      throw err;
    }
  }

  async formsStatusOfStudents(
    bootcampId: number,
    chapterId: number,
    moduleId: number,
    limit: number,
    offset: number
  ) {
    try {
      if (isNaN(bootcampId) || bootcampId <= 0) {
        throw new Error('Invalid bootcampId');
      }

      const zuvyBatchEnrollmentsCount = await db
        .select({
          count: sql<number>`cast(count(${zuvyBatchEnrollments.id}) as int)`,
        })
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.bootcampId, bootcampId));
      const totalStudentss = zuvyBatchEnrollmentsCount[0]?.count ?? 0;

      const statusOfIncompletedStudentForm = await db.query.zuvyBatchEnrollments.findMany({
        where: (batchEnrollments, { sql }) =>
          sql`${batchEnrollments.bootcampId} = ${bootcampId}`,
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
            },

          },
        },

      });

      const statusOfCompletedStudentForm = await db.query.zuvyChapterTracking.findMany({
        where: (chapterTracking, { sql }) =>
          sql`${chapterTracking.chapterId} = ${chapterId} AND ${chapterTracking.moduleId} = ${moduleId}`,
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
            },

          },
        },

      });

      const totalStudentsCount = totalStudentss;
      const totalPages = Math.ceil(totalStudentsCount / limit);

      const data1 = statusOfCompletedStudentForm.map((statusForm) => {
        return {
          id: Number(statusForm['user']['id']),
          name: statusForm['user']['name'],
          emailId: statusForm['user']['email'],
          status: 'Submitted',
        };
      });

      const completedIds = new Set(data1.map(item => item.id));
      const data2 = statusOfIncompletedStudentForm
        .map((statusForm) => {
          return {
            id: Number(statusForm['user']['id']),
            name: statusForm['user']['name'],
            emailId: statusForm['user']['email'],
            status: 'Not Submitted',
          };
        })
        .filter(statusForm => !completedIds.has(statusForm.id));
      const combinedData = [...data1, ...data2];

      return {
        status: "Success",
        code: 200,
        moduleId,
        chapterId,
        combinedData,
        totalPages,
        totalStudentsCount
      };
    } catch (err) {
      throw err;
    }
  }


  async getFormDetailsById(
    moduleId: number,
    chapterId: number,
    userId: number
  ) {
    try {
      const chapterDetails = await db
        .select()
        .from(zuvyModuleChapter)
        .where(eq(zuvyModuleChapter.id, chapterId));

      const FormTracking = await db
        .select()
        .from(zuvyFormTracking)
        .where(sql`${zuvyFormTracking.userId} = ${userId} and ${zuvyFormTracking.chapterId} = ${chapterId} and ${zuvyFormTracking.moduleId} = ${moduleId}`);

      const ChapterTracking = await db
        .select()
        .from(zuvyChapterTracking)
        .where(sql`${zuvyChapterTracking.userId} = ${userId} and ${zuvyChapterTracking.chapterId} = ${chapterId} and ${zuvyChapterTracking.moduleId} = ${moduleId}`);



      if (chapterDetails.length > 0) {
        if (chapterDetails[0].topicId == 7) {
          if (chapterDetails[0].formQuestions !== null) {
            if (FormTracking.length == 0) {
              // const questions = await db
              //   .select({
              //     id: zuvyModuleForm.id,
              //     question: zuvyModuleForm.question,
              //     options: zuvyModuleForm.options,
              //     typeId: zuvyModuleForm.typeId,
              //     isRequired: zuvyModuleForm.isRequired
              //   })
              //   .from(zuvyModuleForm)
              //   .where(
              //     sql`${inArray(zuvyModuleForm.id, Object.values(chapterDetails[0].formQuestions))}`,
              //   );
              // questions['status'] =
              //   ChapterTracking.length != 0
              //     ? 'Completed'
              //     : 'Pending';

              return {
                status: "success",
                code: 200,
                message: "Form not submitted by student"
              }

            }
            else {
              const trackedData = await db.query.zuvyModuleForm.findMany({
                where: (moduleForm, { sql }) => sql`${inArray(moduleForm.id, Object.values(chapterDetails[0].formQuestions))}`,
                with: {

                  formTrackingData: {
                    columns: {
                      chosenOptions: true,
                      answer: true,
                      status: true,
                      updatedAt: true,
                    },
                    where: (formTracking, { sql }) => sql`${formTracking.userId} = ${userId} and ${formTracking.chapterId} = ${chapterId} and ${formTracking.moduleId} = ${moduleId}`,
                  }
                }
              });

              trackedData['status'] =
                ChapterTracking.length != 0
                  ? 'Completed'
                  : 'Pending';

              return {
                status: "success",
                code: 200,
                message: "Form submitted by student",
                trackedData
              }
            }
          }
        }
        else {
          let content = [
            {
              title: chapterDetails[0].title,
              description: chapterDetails[0].description,
              links: chapterDetails[0].links,
              file: chapterDetails[0].file,
              content: chapterDetails[0].articleContent,
            },
          ];
          return content;
        }
      }
      else {
        return 'No Form found';
      }
    } catch (err) {
      throw err;
    }
  }

  async getSubmissionOfAssignment(
    bootcampId: number,
    assignmentName: string
  ): Promise<any> {
    try {
      const topicId = 5;

      // Fetch all tracking data (either filtered by assignment name or not)
      const trackingData = await db.query.zuvyCourseModules.findMany({
        where: (courseModules, { eq }) =>
          eq(courseModules.bootcampId, bootcampId),
        orderBy: (courseModules, { asc }) => asc(courseModules.order),
        with: {
          moduleChapterData: {
            columns: {
              id: true,
              title: true,
            },
            where: (moduleChapter, { and, eq, sql }) =>
              and(
                eq(moduleChapter.topicId, topicId),
                // If assignmentName is provided, filter by title, otherwise return all
                assignmentName
                  ? sql`${moduleChapter.title} ILIKE ${assignmentName + '%'}`
                  : sql`TRUE`
              ),
            with: {
              chapterTrackingDetails: {
                columns: {
                  userId: true,
                },
              },
            },
          },
        },
      });

      // Fetch the total student count for the bootcamp
      const zuvyBatchEnrollmentsCount = await db
        .select({
          count: sql<number>`cast(count(${zuvyBatchEnrollments.id}) as int)`,
        })
        .from(zuvyBatchEnrollments)
        .where(
          sql`(${zuvyBatchEnrollments.bootcampId} = ${bootcampId} AND ${zuvyBatchEnrollments.batchId} IS NOT NULL)`
        );

      // Process tracking data, count submitted students, and filter out empty moduleChapterData
      const filteredTrackingData = trackingData.map((course: any) => {
        course.moduleChapterData = course.moduleChapterData.map((chapterTracking) => {
          chapterTracking['submitStudents'] = chapterTracking['chapterTrackingDetails'].length;
          delete chapterTracking['chapterTrackingDetails'];

          return chapterTracking;
        }).filter(chapterTracking => chapterTracking['submitStudents'] > 0);

        return course;
      }).filter((course: any) => course.moduleChapterData.length > 0);

      // If no assignment name is provided, return all courses regardless of submissions
      const finalTrackingData = assignmentName ? filteredTrackingData : trackingData;

      return [
        null,
        {
          message: 'Submission of assignment for courses has been fetched',
          statusCode: STATUS_CODES.OK,
          data: {
            trackingData: finalTrackingData,
            totalStudents: zuvyBatchEnrollmentsCount[0]?.count,
          },
        },
      ];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }, null];
    }
  }

  async assignmentStatusOfStudents(
    chapterId: number,
    limit: number,
    offset: number,
    searchStudent: string
  ): Promise<any> {
    try {
      // Get chapter details
      const chapterDeadline = await db.select()
        .from(zuvyModuleChapter)
        .where(eq(zuvyModuleChapter.id, chapterId));

      if (chapterDeadline.length > 0) {
        // Query the chapter tracking
        const statusOfStudentCode = await db.query.zuvyChapterTracking.findMany({
          where: (chapterTracking) =>
            sql`${chapterTracking.chapterId} = ${chapterId}`,
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
              where: (user, { sql, or }) =>
                searchStudent
                  ? or(
                    sql`${user.name} ILIKE ${searchStudent + '%'}`,
                    sql`${user.email} ILIKE ${searchStudent + '%'}`
                  )
                  : sql`TRUE`,
              with: {
                studentAssignmentStatus: {
                  columns: {
                    bootcampId: true,
                  },
                },
              },
            },
          },
          limit: limit,
          offset: offset,
        });

        // Get the total student count for pagination
        const totalStudents = await db.select()
          .from(zuvyChapterTracking)
          .where(sql`${zuvyChapterTracking.chapterId} = ${chapterId}`);
        const totalStudentsCount = totalStudents.length;
        const totalPages = Math.ceil(totalStudentsCount / limit);
        const deadlineDate = new Date(chapterDeadline[0].completionDate).getTime();

        // Process the result data with filtering out entries without a valid user
        const data = statusOfStudentCode
          .filter(statusCode => statusCode["user"])
          .map((statusCode) => {
            const studentAssignmentStatus = statusCode;
            let isLate = false;

            if (studentAssignmentStatus && studentAssignmentStatus['completedAt']) {
              const createdAtDate = new Date(studentAssignmentStatus['completedAt']).getTime();
              if (createdAtDate > deadlineDate) {
                isLate = true;
              }
            }

            // Return properties without null or unknown
            return {
              id: Number(statusCode["user"]["id"]),
              name: statusCode["user"]["name"],
              emailId: statusCode["user"]["email"],
              status: isLate ? 'Late Submission' : 'On Time',
              bootcampId: statusCode["user"].studentAssignmentStatus?.bootcampId,
            };
          });

        // Calculate the current page based on limit and offset
        const currentPage = !isNaN(limit) && !isNaN(offset) ? offset / limit + 1 : 1;

        // Return the response with student data
        return [
          null,
          {
            message: 'Assignment Status of the students has been fetched',
            statusCode: STATUS_CODES.OK,
            data: {
              data,
              chapterId: chapterDeadline[0].id,
              chapterName: chapterDeadline[0].title,
              totalPages,
              totalStudentsCount,
              currentPage,
            },
          },
        ];
      } else {
        return [null, { message: 'NO CONTENT FOUND', statusCode: STATUS_CODES.OK }];
      }
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }, null];
    }
  }

  async getAssignmentSubmissionDetailForUser(chapterId: number, userId: number): Promise<any> {
    try {
      const assignmentDetails = await db.query.zuvyModuleChapter.findFirst({
        where: (moduleChapter, { eq }) =>
          eq(moduleChapter.id, chapterId),
        columns: {
          id: true,
          topicId: true,
          title: true,
          articleContent: true,
          completionDate: true
        },
        with: {
          chapterTrackingDetails: {
            columns: {
              completedAt: true
            },
            where: (chapterTracking, { eq }) =>
              eq(chapterTracking.userId, BigInt(userId)),
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true,
                },
                with: {
                  studentAssignmentStatus: {
                    columns: {
                      projectUrl: true
                    }
                  }
                }
              },
            },
          }
        },
      })

      let isSubmittedOnTime = true;
      if (new Date(assignmentDetails['completionDate']).getTime() < new Date(assignmentDetails['chapterTrackingDetails'][0]['completedAt']).getTime()) {
        isSubmittedOnTime = false;
      }
      assignmentDetails['chapterTrackingDetails'][0]['user']['id'] = Number(assignmentDetails['chapterTrackingDetails'][0]['user']['id'])
      assignmentDetails['chapterTrackingDetails'][0]['status'] = isSubmittedOnTime == true ? 'Submitted on time' : 'Submitted late';
      return [null, { message: 'Assignment submission detail of the user has been fetched', statusCode: STATUS_CODES.OK, data: assignmentDetails }]
    }
    catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }, null]
    }
  }

  async submitProperting(assessmentSubmissionId, propertingPutBody: any): Promise<any> {
    try {
      let updatedSubmissionAssessment = await db.update(zuvyAssessmentSubmission).set(propertingPutBody).where(eq(zuvyAssessmentSubmission.id, assessmentSubmissionId)).returning({ eyeMomentCount: zuvyAssessmentSubmission.eyeMomentCount, fullScreenExit: zuvyAssessmentSubmission.fullScreenExit, copyPaste: zuvyAssessmentSubmission.copyPaste, tabChange: zuvyAssessmentSubmission.tabChange });
      if (updatedSubmissionAssessment.length == 0) {
        return [null, { message: "Assessment properting not found", statusCode: STATUS_CODES.NOT_FOUND, data: {} }]
      }
      return [null, { message: 'Assignment properting data updated', statusCode: STATUS_CODES.OK, data: updatedSubmissionAssessment[0] }]
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }, null]
    }
  }

  async deactivateAssessmentSubmission(assessmentSubmissionId: number): Promise<any> {
    try {
      // First, check if the assessment submission exists
      const submission = await db.query.zuvyAssessmentSubmission.findFirst({
        where: (zuvyAssessmentSubmission, { eq }) => eq(zuvyAssessmentSubmission.id, assessmentSubmissionId),
      });

      if (!submission) {
        return [{
          status: 'error',
          statusCode: 404,
          message: 'Assessment submission not found',
        }];
      }

      // Update the active attribute to false instead of deleting
      let updateActiveData:any = { active: false }
      const updated = await db.update(zuvyAssessmentSubmission)
        .set(updateActiveData)
        .where(eq(zuvyAssessmentSubmission.id, assessmentSubmissionId))
        .returning();

      if (!updated || updated.length === 0) {
        return [{
          status: 'error',
          statusCode: 500,
          message: 'Failed to deactivate assessment submission',
        }];
      }

      return [null, {
        status: 'success',
        statusCode: 200,
        message: 'Assessment submission deactivated successfully',
      }];
    } catch (err) {
      return [{
        status: 'error',
        statusCode: 500,
        message: err.message,
      }];
    }
  }
  
  

  async recalcAndFixMCQForAssessment(
    assessmentOutsourseId: number
  ): Promise<any> {
    try {

      function ceilToOneDecimal(num) {
        return Math.ceil(num * 100) / 100;
      }

      const submissions = await db
        .select({
          id: zuvyAssessmentSubmission.id,
          userId: zuvyAssessmentSubmission.userId,
          codingScore: zuvyAssessmentSubmission.codingScore,
          mcqScore: zuvyAssessmentSubmission.mcqScore,
          marks: zuvyAssessmentSubmission.marks,
          percentage: zuvyAssessmentSubmission.percentage,
          isPassed: zuvyAssessmentSubmission.isPassed,
        })
        .from(zuvyAssessmentSubmission)
        .where(eq(zuvyAssessmentSubmission.assessmentOutsourseId, assessmentOutsourseId));

      if (submissions.length === 0) {
        return [null, {
        statusCode: 202,
        message: 'assessmet submission not found',
      }];
      }
      const assessmentMeta = await db
        .select({
          easy: zuvyOutsourseAssessments.easyMcqMark,
          medium: zuvyOutsourseAssessments.mediumMcqMark,
          hard: zuvyOutsourseAssessments.hardMcqMark,
          pass: zuvyOutsourseAssessments.passPercentage,
        })
        .from(zuvyOutsourseAssessments)
        .where(eq(zuvyOutsourseAssessments.id, assessmentOutsourseId))
        .then(r => r[0]!);

      if (!assessmentMeta) {
        return [null, {
          statusCode: 202,
          message: 'assessment not found',
        }];
      }
      let mcqMarks:any = {
        [DIFFICULTY.EASY]: assessmentMeta.easy || 0,
        [DIFFICULTY.MEDIUM]: assessmentMeta.medium || 0,
        [DIFFICULTY.HARD]: assessmentMeta.hard || 0,
      };

      const updatedUserIds: number[] = [];
      let correctOptions = {
        119: [1, 3, 4],
        132: [1, 3]
      };
      for (const sub of submissions) {
        try {
          const quizAnswers = await db
            .select({
              id: zuvyQuizTracking.id,
              variantId: zuvyQuizTracking.variantId,
              chosenOption: zuvyQuizTracking.chosenOption,
            })
            .from(zuvyQuizTracking)
            .where(eq(zuvyQuizTracking.assessmentSubmissionId, sub.id));

          const variantIds = quizAnswers.map(q => q.variantId);
          const quizMasterData = await db.query.zuvyModuleQuizVariants.findMany({
            where: (zuvyModuleQuizVariants, { sql }) =>
              sql`${zuvyModuleQuizVariants.id} in ${variantIds}`,
            with: {
              quiz: {
                columns: {
                  difficulty: true,
                },
              },
            },
          });

          let mcqScore = 0;
          let requiredMCQScore = 0;
          const attemptedMCQs = quizAnswers.length;

          for (const answer of quizAnswers) {
            const matched:any = quizMasterData.find(v => v.id === answer.variantId);
            if (!matched) continue;

            const difficulty = matched.quiz.difficulty;
            const weight = mcqMarks[difficulty] || 0;
            requiredMCQScore += weight;
            let isCorrect;
            if (!correctOptions[matched.id]){
              isCorrect = answer.chosenOption === matched.correctOption;
            } else {
              let Correct_options = correctOptions[matched.id]
              isCorrect = Correct_options?.includes(answer.chosenOption)? true: false ;
            }
            if (isCorrect) mcqScore += weight;
            // Update quiz tracking status
            await db.update(zuvyQuizTracking)
              .set({ status: isCorrect ? 'passed' : 'failed' })
              .where(eq(zuvyQuizTracking.id, answer.id));
          }

          const safeCodingScore = Number(sub.codingScore) || 0;
          let newMarks = safeCodingScore + mcqScore;
          const totalPossible = safeCodingScore + requiredMCQScore;
          let percentage = totalPossible > 0
            ? parseFloat(((newMarks / totalPossible) * 100).toFixed(2))
            : 0;
          const isPassed = percentage >= (Number(assessmentMeta.pass) || 0);

          const hasChanged =
            mcqScore !== sub.mcqScore ||
            newMarks !== sub.marks ||
            percentage !== sub.percentage ||
            isPassed !== sub.isPassed;

          if (hasChanged) {
            const updatedSubmission:any = {
              mcqScore,
              marks: newMarks,
              percentage,
              isPassed,
            };
            await db.update(zuvyAssessmentSubmission)
              .set(updatedSubmission)
              .where(eq(zuvyAssessmentSubmission.id, sub.id));
            this.logger.log(`Updated submission ${sub.id} with new marks: ${newMarks}, percentage: ${percentage}, isPassed: ${isPassed} for userId: ${sub.userId}`);
            updatedUserIds.push(sub.userId);

            // ✉️ Send email after update
            await this.sendScoreUpdateEmailToStudent(sub.userId, percentage);
          }

        } catch (err) {
          // console.log(err);
          console.error(`❌ Error in submission ${sub.id}:`, err);
        }
      }

      this.logger.log(`✅ MCQ recalculation + emails complete. Updated user ids:', ${JSON.stringify(updatedUserIds)}`);
      return [null, updatedUserIds];
    } catch (err) {
      console.error('❌ Fatal error during MCQ recalculation:', err);
      return [{
        status: 'error',
        statusCode: 500,
        message: 'Fatal error recalculating MCQ',
      }];
    }
  }


  async sendScoreUpdateEmailToStudent(userId: any, updatedScore: number) {
    AWS.config.update({
      accessKeyId: AWS_SUPPORT_ACCESS_KEY_ID,
      secretAccessKey: AWS_SUPPORT_ACCESS_SECRET_KEY,
      region: 'ap-south-1'
    });

    const ses = new AWS.SES();

    const user = await db.query.users.findFirst({
      where: (zuvyUser, { eq }) => eq(zuvyUser.id, userId),
    });

    if (!user) {
      console.warn(`⚠️ User not found for ID ${userId}`);
      return;
    }

    const emailText = `
Dear ${user.name || 'Student'},

We would like to inform you that your score for the Final Assessment held on 3rd–4th May has been updated.

Due to a discrepancy in a few multiple-choice questions where incorrect options were initially marked as correct, some students' scores were affected. This issue has now been resolved, and your score has been recalculated based on the option you originally selected.

Your updated score is: ${updatedScore}%

We sincerely apologize for the inconvenience caused.

You can view your latest score by logging into your Zuvy LMS account—this has been reflected in the system.

Thank you for your understanding.

Best regards,  
Zuvy LMS Team
`;

    const emailParams = {
      Source: SUPPORT_EMAIL,
      Destination: {
        ToAddresses: [user.email],
      },
      Message: {
        Subject: { Data: 'Updated Score for Final Assessment – 3rd–4th May' },
        Body: {
          Text: { Data: emailText },
        },
      },
    };

    try {
      const result = await ses.sendEmail(emailParams).promise();
      console.log(`📨 Email sent to ${user.email}`, result.MessageId);
    } catch (err) {
      console.error(`❌ Failed to send email to ${user.email}`, err);
    }
  }

    /**
   * Processes a single batch of assessment submissions for a given assessmentOutsourseId.
   * Returns the processed results for the batch.
   */
  async batchProcessAssessmentSubmissions(assessmentOutsourseId: number, limit: number, offset: number) {
    let results = [];
    // Fetch a batch of submissions
    const submissions = await db
      .select({
        id: zuvyAssessmentSubmission.id,
        userId: zuvyAssessmentSubmission.userId,
        tabChange: zuvyAssessmentSubmission.tabChange,
        copyPaste: zuvyAssessmentSubmission.copyPaste,
        fullScreenExit: zuvyAssessmentSubmission.fullScreenExit,
        eyeMomentCount: zuvyAssessmentSubmission.eyeMomentCount,
      })
      .from(zuvyAssessmentSubmission)
      .where(eq(zuvyAssessmentSubmission.assessmentOutsourseId, assessmentOutsourseId))
      .limit(limit)
      .offset(offset);

    if (!submissions.length) {
      return { totalProcessed: 0, results };
    }

    for (const sub of submissions) {
      const data = {
        tabChange: sub.tabChange,
        copyPaste: sub.copyPaste ?? null,
        fullScreenExit: sub.fullScreenExit ?? null,
        eyeMomentCount: sub.eyeMomentCount ?? null,
        typeOfsubmission: 'studentSubmited',
      };
      // Call assessmentSubmission for each record
      try {
        const [err, result] = await this.assessmentSubmission(data, sub.id, sub.userId);
        if (err) {
          results.push({ id: sub.id, error: err });
        } else {
          results.push({ id: sub.id, status: 'updated' });
        }
      } catch (e) {
        results.push({ id: sub.id, error: e.message });
      }
    }
    return { totalProcessed: submissions.length, results };
  }
}
