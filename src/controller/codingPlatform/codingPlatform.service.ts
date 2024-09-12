import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { notInArray, sql } from 'drizzle-orm';
import axios from 'axios';
import { SubmitCodeDto, CreateProblemDto } from './dto/codingPlatform.dto';
import * as _ from 'lodash';
import {
  zuvyCodingQuestions,
  zuvyPracticeCode,
  zuvyTestCases,
  zuvyTestCasesSubmission
} from '../../../drizzle/schema';
import { generateTemplates } from '../../helpers/index';
import { STATUS_CODES } from "../../helpers/index";
import { helperVariable } from 'src/constants/helper';

// Difficulty Points Mapping
let { ACCEPTED, SUBMIT, RUN, WAIT_API_RESPONSE } = helperVariable;
const { RAPID_BASE_URL, RAPID_API_KEY, RAPID_HOST } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class CodingPlatformService {
  async submitCodeBatch(sourceCode: SubmitCodeDto, codingOutsourseId: number, action: string): Promise<any> {
    let testCase;
    if (RUN === action) {
      testCase = 3;
    } else {
      testCase = 0;
    }
    const [error, question] = await this.getCodingQuestion(codingOutsourseId, false, testCase)
    if (error) {
      return [error];
    }
    let testCasesArray = question.data.testCases;
    const preparedSubmissions = testCasesArray.map((testCase) => {
      var input = [];
      var output = [];
      if (action == SUBMIT) {
        input.push(...testCase.inputs.map(input => input.parameterValue));
        output.push(testCase.expectedOutput.parameterValue);
      }
      else if (action == RUN) {
        input.push(...testCase.inputs.map(input => input.parameterValue));
        output.push(testCase.expectedOutput.parameterValue);
      }
      const stdinput = input.map(item => item.toString()).join('\n');
      const encodedStdInput = Buffer.from(stdinput).toString('base64')
      const stdoutput = output.map(item => item.toString()).join('\n');
      const encodedStdOutput = Buffer.from(stdoutput).toString('base64');
      return {
        language_id: sourceCode.languageId,
        source_code: sourceCode.sourceCode,
        stdin: encodedStdInput,
        expected_output: encodedStdOutput
      }
    });
    const options = {
      method: 'POST',
      url: `${RAPID_BASE_URL}/submissions/batch?base64_encoded=true&wait=true`,
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': RAPID_API_KEY,
        'X-RapidAPI-Host': RAPID_HOST
      },
      data: {
        submissions: preparedSubmissions
      }
    };

    try {
      const response = await axios.request(options);
      const tokens = response.data?.map(submission => submission.token);
      let submissionInfo, err;

      await new Promise<void>(resolve => setTimeout(async () => {
        [err, submissionInfo] = await this.getCodeInfo(tokens);
        resolve();
      }, WAIT_API_RESPONSE));

      if (err) {
        return [err];
      }
      let testSubmission = testCasesArray?.map((testCase, index) => {
        return {
          testcastId: testCase?.id,
          status: submissionInfo.data.submissions[index].status?.description,
          token: submissionInfo.data.submissions[index]?.token,
          stdOut: submissionInfo.data.submissions[index]?.stdout,
          stderr: submissionInfo.data.submissions[index]?.stderr,
          memory: submissionInfo.data.submissions[index]?.memory,
          time: submissionInfo.data.submissions[index]?.time,
        }
      })
      return [null, { statusCode: STATUS_CODES.OK, message: 'Code submitted successfully', data: testSubmission }];
    } catch (error) {
      return [{ statusCode: STATUS_CODES.BAD_REQUEST, message: error.message }];
    }
  }

  async submitPracticeCode(questionId: number, sourceCode, action, userId, submissionId, codingOutsourseId): Promise<any> {
    try {
      if (![RUN, SUBMIT].includes(action.toLowerCase())) {
        return [{ statusCode: STATUS_CODES.BAD_REQUEST, message: 'Invalid action' }];
      }
      let [err, testcasesSubmission] = await this.submitCodeBatch(sourceCode, questionId, action);
      if (err) {
        return [err];
      }
      if (testcasesSubmission.data[0].stderr && action != SUBMIT) {
        return [null, { statusCode: STATUS_CODES.CONFLICT, message: `${action} ${testcasesSubmission.data[0].status}`, data: [testcasesSubmission.data[0]] }];
      }
      let insertValues
      if (testcasesSubmission.data.length >= 0) {
        insertValues = { status: ACCEPTED, sourceCode: sourceCode.sourceCode };
      } else {
        insertValues = { status: 'Error', sourceCode: sourceCode.sourceCode };
      }

      for (let testSub of testcasesSubmission.data) {
        if (testSub.status !== ACCEPTED) {
          insertValues["status"] = testSub.status
          break;
        }
      }
      if (action === RUN) {
        // i want to update the last submission sourceCode where last submission sourceCode 
        let queryString = sql`${zuvyPracticeCode.questionId} = ${questionId} AND ${zuvyPracticeCode.userId} = ${userId} AND ${zuvyPracticeCode.action} = ${action}`
        if (submissionId) {
          queryString = sql`${queryString} AND ${zuvyPracticeCode.submissionId} = ${submissionId} AND ${zuvyPracticeCode.codingOutsourseId} = ${codingOutsourseId}`;
        }
        let response = await db.query.zuvyPracticeCode.findMany({
          where: queryString,
          columns: {
            id: true,
            status: true
          }
        });
        if (response.length === 0) {
          insertValues["userId"] = userId;
          insertValues["questionId"] = questionId;
          insertValues["action"] = action;
          if (submissionId) {
            insertValues["submissionId"] = submissionId;
          }
          if (codingOutsourseId) {
            insertValues["codingOutsourseId"] = codingOutsourseId;
          }
          await db.insert(zuvyPracticeCode).values(insertValues).returning();
        } else {
          await db.update(zuvyPracticeCode).set(insertValues).where(sql`${zuvyPracticeCode.id} = ${response[0].id}`).returning();
        }
        return [null, { statusCode: STATUS_CODES.OK, message: `${action} ${testcasesSubmission.data[0].status}`, data: testcasesSubmission.data }];

      }
      insertValues["userId"] = userId;
      insertValues["questionId"] = questionId;
      insertValues["action"] = action;
      if (submissionId) {
        insertValues["submissionId"] = submissionId;
      }
      if (codingOutsourseId) {
        insertValues["codingOutsourseId"] = codingOutsourseId;
      }
      let practiceSubmission = await db.insert(zuvyPracticeCode).values(insertValues).returning();

      let testcasesSubmissionInsert = testcasesSubmission.data.map((testcase) => {
        return {
          submissionId: practiceSubmission[0].id,
          testcastId: testcase.testcastId,
          status: testcase.status,
          token: testcase.token,
          stdout: testcase.stdOut,
          memory: testcase.memory,
          time: testcase.time,
        }
      })
      let test_Submission = await db.insert(zuvyTestCasesSubmission).values(testcasesSubmissionInsert).returning();
      if (test_Submission.length !== 0) {
        return [null, { statusCode: STATUS_CODES.OK, message: `${action} ${testcasesSubmission.data[0].status}`, data: test_Submission }];
      } else {
        return [{ statusCode: STATUS_CODES.BAD_REQUEST, message: 'Error in submitting code' }];
      }
    } catch (error) {
      Logger.error({ error });
      return [{ statusCode: STATUS_CODES.BAD_REQUEST, message: error.message }];
    }
  }

  async getPracticeCode(questionId, userId, submissionId, codingOutsourseId): Promise<any> {
    try {
      let queryString;
      if (isNaN(submissionId)) {
        queryString = sql`${zuvyPracticeCode.questionId} = ${questionId} AND ${zuvyPracticeCode.userId} = ${userId} AND ${zuvyPracticeCode.submissionId} IS NULL`
      } else {
        queryString = sql`${zuvyPracticeCode.questionId} = ${questionId} AND ${zuvyPracticeCode.userId} = ${userId} AND ${zuvyPracticeCode.submissionId} = ${submissionId} AND ${zuvyPracticeCode.codingOutsourseId} = ${codingOutsourseId}`
      }
      let response = await db.query.zuvyPracticeCode.findMany({
        where: queryString,
        columns: {
          id: true,
          status: true,
          action: true,
          questionId: true,
          submissionId: true,
          codingOutsourseId: true,
          createdAt: true,
          sourceCode: true
        },
        with: {
          questionDetail: true,
          TestCasesSubmission: {
            with: {
              testCases: true,
            }
          }
        },
        limit: 1,
        orderBy: (zuvyPracticeCode, { sql }) => sql`${zuvyPracticeCode.id} DESC`,
      });
      if (response.length === 0) {
        return [{ statusCode: STATUS_CODES.NOT_FOUND, message: 'No practice code available for the given question' }];
      } else {
        return [null, { statusCode: STATUS_CODES.OK, message: 'Practice code fetched successfully', data: { ...response[0] } }];
      }
    } catch (error) {
      return [{ statusCode: STATUS_CODES.BAD_REQUEST, message: error.message }];
    }
  }

  async getTestCasesSubmission(TestCasesSubmission: any): Promise<any> {
    try {
      const submissionsInfoPromises = TestCasesSubmission.map(async (submission: any) => {
        const options = {
          method: 'GET',
          url: `${RAPID_BASE_URL}/submissions/${submission.token}?base64_encoded=true&fields=*`,
          headers: {
            'X-RapidAPI-Key': RAPID_API_KEY,
            'X-RapidAPI-Host': RAPID_HOST
          }
        };
        const response = await axios.request(options);
        let status = response.data.status?.description;
        return { ...submission, ...response.data, status };
      });
      const submission = await Promise.all(submissionsInfoPromises);
      if (submission.length === 0) {
        return [{ message: 'No submission available for the given submissionId', statusCode: STATUS_CODES.NOT_FOUND }];
      }

      return [null, { message: 'All submission by submission id', data: submission, statusCode: STATUS_CODES.OK }];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }



  async getCodeInfo(tokens) {
    const options = {
      method: 'GET',
      url: `${RAPID_BASE_URL}/submissions/batch?tokens=${tokens.join(',')}&base64_encoded=false&fields=token,stdout,stderr,status_id,language_id,source_code,status,memory,time,`,

      headers: {
        'X-RapidAPI-Key': RAPID_API_KEY,
        'X-RapidAPI-Host': RAPID_HOST
      }
    };

    try {
      const response = await axios.request(options);
      return [null, { statusCode: STATUS_CODES.OK, message: 'Code submitted successfully', data: response.data }];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  // token test case sourse code
  async getSourceCodeByToken(token: string): Promise<any> {
    try {
      const options = {
        method: 'GET',
        url: `${RAPID_BASE_URL}/submissions/${token}?base64_encoded=true&fields=source_code,stdout,stderr,status_id,language_id,created_at,finished_at,`,
        headers: {
          'X-RapidAPI-Key': RAPID_API_KEY,
          'X-RapidAPI-Host': RAPID_HOST
        }
      };
      const response = await axios.request(options);
      return [null, { message: 'Code fetched successfully', data: response.data, statusCode: STATUS_CODES.OK }];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }


  async createCodingProblem(codingProblem: CreateProblemDto): Promise<any> {
    try {
      const newQuestionCreated = await db.insert(zuvyCodingQuestions).values(codingProblem).returning();
      return [null, { message: 'Coding problem created successfully', data: newQuestionCreated, statusCode: STATUS_CODES.CREATED }];
    } catch (err) {
      return [{ message: err.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  async createCodingQuestion(createCodingQuestionDto: any): Promise<any> {
    const { testCases, ...questionData } = createCodingQuestionDto;
    questionData['usage'] = 0;
    try {
      const question: any = await db.insert(zuvyCodingQuestions).values(questionData).returning();
      let testCaseAndExpectedOutput = [];
      for (let i = 0; i < testCases.length; i++) {
        testCaseAndExpectedOutput.push({ questionId: question[0].id, inputs: testCases[i].inputs, expectedOutput: testCases[i].expectedOutput });
      }
      let TestCases = await db.insert(zuvyTestCases).values(testCaseAndExpectedOutput).returning();
      // return [null,{...question[0], TestCases}];
      return [null, { message: 'Coding question created successfully', data: { ...question[0], TestCases }, statusCode: STATUS_CODES.CREATED }];
    } catch (error) {
      return [[{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }]];
    }
  }


  async updateCodingQuestion(id: number, updateCodingQuestionDto: any): Promise<any> {
    let { testCases, ...questionData } = updateCodingQuestionDto;
    try {
      const question = await db.update(zuvyCodingQuestions).set(questionData).where(sql`${zuvyCodingQuestions.id} = ${id}`).returning();
      let missingIdElements = [];
      if (testCases.length < 2) {
        return [{ message: "Test case should be minimum 2", statusCode: STATUS_CODES.BAD_REQUEST }];
      }
      if (Array.isArray(testCases) && testCases.length > 0) {
        missingIdElements = testCases.filter(element => !element.hasOwnProperty('id'));
        testCases = testCases.filter(element => element.hasOwnProperty('id'));
        missingIdElements = missingIdElements.map(element => ({
          ...element,
          questionId: id
        }));
      }
      await db.delete(zuvyTestCases)
      .where(
        sql`${zuvyTestCases.questionId} = ${id} AND ${notInArray(zuvyTestCases.id, testCases.map(tc => tc.id))}`
      );
      const newAddedTestCases: any[] = missingIdElements.length > 0 ? await db.insert(zuvyTestCases).values(missingIdElements).returning() : [];
      await this.updateTestCaseAndExpectedOutput(testCases);
      return [null, { message: 'Coding question updated successfully', data: { question, "testCases": [...testCases, ...newAddedTestCases] }, statusCode: STATUS_CODES.OK }];
    } catch (error) {
      Logger.error(JSON.stringify(error));
      return [[{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }]];
    }
  }

  async deleteCodingQuestion(id: number): Promise<any> {
    try {
      let data = await db.delete(zuvyCodingQuestions).where(sql`${zuvyCodingQuestions.id} = ${id}`).returning();
      if (data.length === 0) {
        return [{ message: 'Not found', statusCode: STATUS_CODES.NOT_FOUND }];
      }
      return [null, { message: 'Coding question deleted successfully', statusCode: STATUS_CODES.OK }];
    } catch (error) {
      return [[{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }]];
    }
  }

  async getCodingQuestion(id: number, withTemplate: boolean = true, totalCasses = 0): Promise<any> {
    try {
      const question = await db.query.zuvyCodingQuestions.findMany({
        where: (zuvyCodingQuestions, { sql }) => sql`${zuvyCodingQuestions.id} = ${id}`,
        columns: {
          id: true,
          title: true,
          description: true,
          difficulty: true,
          constraints: true,
          content: true,
          tagId: true,
          createdAt: true,
        },
        with: {
          testCases: {
            columns: {
              id: true,
              inputs: true,
              expectedOutput: true,
            },
            orderBy: (testCase, { asc }) => asc(testCase.id),
            limit: totalCasses == 3 ? totalCasses : undefined,
          }
        }
      })

      if (question.length === 0) {
        return [{ message: 'Not found', statusCode: STATUS_CODES.NOT_FOUND }];
      }

      if (withTemplate) {
        let [errorGenerateTemplate, templates] = await generateTemplates(question[0].title, question[0].testCases[0].inputs);
        question[0]["templates"] = templates;
      }
      return [null, { message: 'Coding question fetched successfully', data: question[0], statusCode: STATUS_CODES.OK }];
    } catch (error) {
      return [[{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }]];
    }
  }
  // i want to update the test case and expected output for the coding question
  async updateTestCaseAndExpectedOutput(testcases: any): Promise<any> {
    try {
      testcases.forEach(async (testCase) => {
        const { inputs, expectedOutput } = testCase;
        await db.update(zuvyTestCases).set({ inputs, expectedOutput }).where(sql`${zuvyTestCases.id} = ${testCase.id}`);
      })
      return [null, { message: 'Test case and expected output updated successfully', statusCode: STATUS_CODES.OK }];
    } catch (error) {
      Logger.error(JSON.stringify(error));
      return [[{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }]];
    }
  }


  async deleteCodingTestcase(id: number): Promise<any> {
    try {
      let data = await db.delete(zuvyTestCases).where(sql`${zuvyTestCases.id} = ${id}`).returning();
      if (data.length === 0) {
        return [{ message: 'Not found', statusCode: STATUS_CODES.NOT_FOUND }];
      }
      return [null, { message: 'Test case deleted successfully', statusCode: STATUS_CODES.OK }];
    } catch (error) {
      return [[{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }]];
    }
  }

  async addTestCase(questionId, updateTestCaseDto): Promise<any> {
    try {
      const { inputs, expectedOutput } = updateTestCaseDto
      let insertTestcase: any = { questionId, inputs, expectedOutput };
      const testCase = await db.insert(zuvyTestCases).values(insertTestcase).returning();
      return [null, { message: "added the test case", data: testCase[0] }, STATUS_CODES.CREATED];
    } catch (error) {
      return [[{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }]];
    }
  }

  // getTestcasesSubmissionBySubmissionId
  async getTestcasesSubmissionBySubmissionId(submissionId: number): Promise<any> {
    try {
      const submission = await db.query.zuvyPracticeCode.findMany({
        where: (zuvyPracticeCode, { sql }) => sql`${zuvyPracticeCode.id} = ${submissionId}`,
        columns: {
          id: true,
          status: true,
          action: true,
          questionId: true,
          submissionId: true,
          codingOutsourseId: true,
          createdAt: true,
          sourceCode: true
        },
        with: {
          questionDetail: {
            columns: {
              id: true,
              title: true,
              description: true,
              difficulty: true,
            },
            with: {
              testCases: {
                columns: {
                  id: true,
                  inputs: true,
                  expectedOutput: true,
                },
              },
            }
          },
          TestCasesSubmission: true
        }
      });
      if (submission.length === 0) {
        return [{ message: 'No submission available for the given submissionId', statusCode: STATUS_CODES.NOT_FOUND }];
      }
      return [null, { message: 'All submission by submission id', data: submission[0], statusCode: STATUS_CODES.OK }];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }
  async getSubmissionsId(questionId: number): Promise<any> {
    try {
      const submissions = await db.query.zuvyPracticeCode.findMany({
        where: (zuvyPracticeCode, { sql }) => sql`${zuvyPracticeCode.questionId} = ${questionId} AND ${zuvyPracticeCode.action} = ${SUBMIT}`,
        columns: {
          id: true,
          status: true,
          action: true,
          questionId: true,
          submissionId: true,
          codingOutsourseId: true,
          createdAt: true,
          sourceCode: true
        },
        with: {
          questionDetail: true
        }
      });
      if (submissions.length === 0) {
        return [{ message: 'No submission available for the given questionId', statusCode: STATUS_CODES.NOT_FOUND }];
      }
      return [null, { message: 'All submission by question id', data: submissions, statusCode: STATUS_CODES.OK }];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }
}
