import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, count, lte, inArray } from 'drizzle-orm';
import * as _ from 'lodash';
import { zuvyBatchEnrollments, zuvyAssessmentSubmission, zuvyChapterTracking, zuvyOpenEndedQuestionSubmission, zuvyProjectTracking, zuvyQuizTracking, zuvyModuleChapter, zuvyFormTracking, zuvyPracticeCode,zuvyOutsourseQuizzes, zuvyModuleQuizVariants, zuvyOutsourseAssessments } from '../../../drizzle/schema';
import { InstructorFeedbackDto, PatchOpenendedQuestionDto, CreateOpenendedQuestionDto } from './dto/submission.dto';
import { STATUS_CODES } from 'src/helpers';
import { helperVariable } from 'src/constants/helper';

// Difficulty Points Mapping
let { ACCEPTED, SUBMIT } = helperVariable;

@Injectable()
export class SubmissionService {

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
    let { hardMcqMark, easyMcqMark, mediumMcqMark, hardCodingMark, mediumCodingMark, easyCodingMark } = data
    const MCQ_POINTS = { easy: easyMcqMark, medium: mediumMcqMark, hard: hardMcqMark };
    const CODING_POINTS = { easy: easyCodingMark, medium: mediumCodingMark, hard: hardCodingMark };
    const totalMCQPoints = data.Quizzes.reduce((sum, q) => sum + MCQ_POINTS[q.difficulty], 0);
    // const totalOpenPoints = data.OpenEndedQuestions.reduce((sum, q) => sum + pointsMapping.OPEN_ENDED_POINTS[q.difficulty], 0);
    const totalCodingPoints = data.CodingQuestions.reduce((sum, q) => sum + CODING_POINTS[q.difficulty], 0);

    let codingQuestionCount = data.CodingQuestions.length;
    let mcqQuestionCount = data.Quizzes.length;
    let openEndedQuestionCount = data.OpenEndedQuestions.length;
    const totalPoints = totalMCQPoints + totalCodingPoints;

    return { totalMCQPoints, totalCodingPoints, totalPoints, codingQuestionCount, mcqQuestionCount, openEndedQuestionCount };
  }

  async calculateAssessmentResults(data, codingSubmission, totalPoints) {
    let quizTotalAttemted = 0;
    let quizCorrect = 0;
    let quizScore = 0;
    let openTotalAttemted = 0;
    let codingTotalAttemted = 0;
    let codingScore = 0;
    let { hardMcqMark, easyMcqMark, mediumMcqMark, hardCodingMark, mediumCodingMark, easyCodingMark } = data
    const MCQ_POINTS = { easy: easyMcqMark, medium: mediumMcqMark, hard: hardMcqMark };
    const CODING_POINTS = { easy: easyCodingMark, medium: mediumCodingMark, hard: hardCodingMark };
    // Processing Quizzes
    data.quizSubmission.forEach(quiz => {
      quizTotalAttemted += 1;
      if (quiz.chosenOption == quiz.submissionData?.Quiz.correctOption) {
        quizCorrect += 1;
        quizScore += MCQ_POINTS[quiz.submissionData?.Quiz.difficulty];
      }
    });

    data.openEndedSubmission.forEach(question => {
      openTotalAttemted += 1;
    });


    data.PracticeCode.forEach(question => {
      let existingEntry = codingSubmission.find(entry => entry.id === question.questionId);
      if (existingEntry) {
        if (!existingEntry.submissions) {
          existingEntry.submissions = {};
        }
        existingEntry.submissions = {
          id: question.id,
          status: question.status,
          action: question.action,
          createdAt: question.createdAt,
          codingOutsourseId: question.codingOutsourseId,
          submissionId: question.submissionId,
          questionId: question.questionId,
          SourceCode: question.sourceCode,
          // ...question
        }
        codingTotalAttemted += 1;
        codingScore += CODING_POINTS[question.questionDetail.difficulty];
      }
    });

    const totalScore = quizScore + codingScore;
    let percentage = totalScore === 0 ? 0 : (totalScore / totalPoints) * 100;

    // Assessment pass status
    const passStatus = percentage >= data.submitedOutsourseAssessment?.passPercentage;

    data.openEndedSubmission = {
      openTotalAttemted,
    }
    data.quizSubmission = {
      quizTotalAttemted,
      quizCorrect,
      quizScore,
    }
    data.PracticeCode = {
      codingTotalAttemted,
      codingScore
    }
    data.marks = totalScore;
    return { ...data, passStatus, percentage, passPercentage: data?.submitedOutsourseAssessment?.passPercentage, codingSubmission };
  }


  async assessmentOutsourseData(assessmentOutsourseId: number) {
    try {
      const assessment = await db.query.zuvyOutsourseAssessments.findMany({
        where: (zuvyOutsourseAssessments, { eq }) =>
          eq(zuvyOutsourseAssessments.id, assessmentOutsourseId),
        with: {
          CodingQuestions: {
            columns: {
              id: true,
              assessmentOutsourseId: true,
              bootcampId: true
            },
            with: {
              CodingQuestion: true
            }
          },
          ModuleAssessment: true,
          Quizzes: {
            columns: {
              id: true,
              assessmentOutsourseId: true,
              bootcampId: true
            },
            with: {
              Quiz: {
                with: {
                  quizVariants: true
                }
              },
            }
          },
          OpenEndedQuestions: {
            columns: {
              id: true,
              assessmentOutsourseId: true,
              bootcampId: true
            },
            with: {
              OpenEndedQuestion: true
            }
          }
        },
      })

      if (assessment == undefined || assessment.length == 0) {
        throw ({
          status: 'error',
          statusCode: 404,
          message: 'Assessment not found',
        });
      }
      let formatedData = await this.formatedChapterDetails(assessment[0]);
      return { ...formatedData, codingQuestions: assessment[0].CodingQuestions };
    } catch (err) {
      throw err;
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
              name: true
            }
          },
          submitedOutsourseAssessment: true,
          openEndedSubmission: {
            columns: {
              id: true,
              answer: true,
              questionId: true,
              feedback: true,
              marks: true,
              startAt: true,
              submitedAt: true,
            },
            with: {
              submissionData: {
                with: {
                  OpenEndedQuestion: true
                }
              },

            }
          },
          quizSubmission: {
            columns: {
              id: true,
              chosenOption: true,
              questionId: true,
              attemptCount: true,
            },
            with: {
              submissionData: {
                with: {
                  Quiz: {
                    with: {
                      quizVariants: true
                    }
                  }
                }
              }
            }
          },
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
        throw ({
          status: 'error',
          statusCode: 404,
          message: 'Assessment not found',
        });
      }
      let { codingQuestions, ...assessment_data } = await this.assessmentOutsourseData(data.assessmentOutsourseId);
      const { totalMCQPoints, totalCodingPoints, totalPoints, codingQuestionCount, mcqQuestionCount, openEndedQuestionCount } = await this.calculateTotalPoints(assessment_data);
      let calData = await this.calculateAssessmentResults(data, codingQuestions, totalPoints);

      return { ...calData, totalMCQPoints, totalCodingPoints, codingQuestionCount, mcqQuestionCount, openEndedQuestionCount };
    }
    catch (err) {
      throw err;
    }
  }


  async assessmentSubmission(data, id: number, userId: number) {
    try {
      let submitData = await this.getAssessmentSubmission(id, userId);
      if (submitData == undefined || submitData == null) {
        throw ({
          status: 'error',
          statusCode: 404,
          message: 'Assessment not found',
        });
      } else if (submitData.userId != userId) {
        throw ({
          status: 'error',
          statusCode: 400,
          message: 'Unauthorized assessment submission',
        });
      } else if (submitData.submitedAt != null) {
        throw ({
          status: 'error',
          statusCode: 400,
          message: 'Assessment already submitted',
        });
      }
      data['submitedAt'] = new Date().toISOString();
      data = {
        ...data,
        marks: submitData.marks,
        isPassed: submitData.passStatus,
        percentage: submitData.percentage,
        codingQuestionCount: submitData.codingQuestionCount,
        mcqQuestionCount: submitData.mcqQuestionCount,
        openEndedQuestionCount: submitData.openEndedQuestionCount,
        attemptedCodingQuestions: submitData.PracticeCode.codingTotalAttemted,
        attemptedMCQQuestions: submitData.quizSubmission.quizTotalAttemted,
        attemptedOpenEndedQuestions: submitData.openEndedSubmission.openTotalAttemted,
        codingScore: submitData.PracticeCode.codingScore,
        openEndedScore: 0, // Assuming no data provided
        requiredCodingScore: submitData.totalCodingPoints,
        requiredOpenEndedScore: 0, // Assuming no data provided
      };
      let assessment = await db.update(zuvyAssessmentSubmission).set(data).where(eq(zuvyAssessmentSubmission.id, id)).returning();
      if (assessment == undefined || assessment.length == 0) {
        throw ({
          status: 'error',
          statusCode: 404,
          message: 'Assessment not found',
        });
      }
      return assessment[0];
    } catch (err) {
      console.error('Error in assessmentSubmission:', err);
      throw err;
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
  async submitQuiz(answers, userId: number, assessmentSubmissionId: number, assessmentOutsourseId): Promise<any> {
    try {
      let submissionData = await this.getSubmissionQuiz(assessmentSubmissionId, userId);
      let InsertData:any = []; // Initialize InsertData as an array
      let updateData = []; // Initialize updateData as an array
      let updatePromises = []; // Use an array to collect update promises
      // if submission already exists then update the submission
      let Assessments_master_data = await db.select().from(zuvyOutsourseAssessments).where(eq(zuvyOutsourseAssessments.id ,assessmentOutsourseId))

      let mcq_marks = {
        Easy: Assessments_master_data[0].easyMcqMark,
        Medium: Assessments_master_data[0].mediumMcqMark,
        Hard: Assessments_master_data[0].hardMcqMark,
      }
      let filterQuestionId = submissionData.map((answer) => answer.variantId);
      let mcq_score = 0
      let quiz_master_data = await db.query.zuvyModuleQuizVariants.findMany({
        where: (zuvyModuleQuizVariants, { sql }) => sql`${zuvyModuleQuizVariants.id} in ${filterQuestionId}`, 
        with: {
          quiz:{
            columns: {
              difficulty:true,
              id:true
            }
          }
        },
      });
      let requiredMCQScore = 0;
      quiz_master_data.map((data:any) => {
        requiredMCQScore += mcq_marks[data.quiz.difficulty]
      })
      if (submissionData.length > 0) {
        answers.forEach((answer) => {
          quiz_master_data.find((mcq:any)=> {
            if (mcq.id === answer.variantId && answer.chosenOption == mcq.correctOption){
              mcq_score += mcq_marks[mcq.quiz.difficulty]
            }
          })
          if (filterQuestionId.includes(answer.variantId)) {
            // Collect update promises
            updatePromises.push(db.update(zuvyQuizTracking).set({ ...answer }).where(sql`${zuvyQuizTracking.questionId} = ${answer.questionId} and ${zuvyQuizTracking.assessmentSubmissionId} = ${assessmentSubmissionId} and ${zuvyQuizTracking.userId} = ${userId}`).returning());
          } else {
            // Prepare data for insertion
            InsertData.push({ ...answer, userId, assessmentSubmissionId });
          }
        });
        // Execute all update operations
        if (updatePromises.length > 0) {
          let updateResults = await Promise.all(updatePromises);
          updateResults.forEach(result => {
            updateData.push(result[0]);
          });
        }
      } else {
        // Prepare data for insertion if no submission data exists
        InsertData = answers.map((answer) => ({ ...answer, userId, assessmentSubmissionId }));
      }

      // Execute insert operation if there's data to insert
      if (InsertData.length > 0) {
        InsertData = await db.insert(zuvyQuizTracking).values(InsertData).returning();
      }
      let updateAssessmentMcqInfo:any = {mcqScore: mcq_score, requiredMCQScore, attemptedMCQQuestions:answers.length};
      await db.update(zuvyAssessmentSubmission).set(updateAssessmentMcqInfo).where(sql`${zuvyAssessmentSubmission.id} = ${assessmentSubmissionId}`).returning()
      // Since updateData is not directly returned from db.update, it's not included in the return statement
      return [null,{ message: 'Successfully save the Quiz.', data: [...InsertData, ...updateData] }]; // Adjusted return value
    } catch (err) {
      console.log({err})
      return [{message: err.message}]
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
}