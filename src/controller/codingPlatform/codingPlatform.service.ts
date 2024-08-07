import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, count, lte, desc } from 'drizzle-orm';
// import { BatchesService } from '../batches/batch.service';
import axios from 'axios';
import { SubmitCodeDto, CreateProblemDto } from './dto/codingPlatform.dto';
import * as _ from 'lodash';
import {
  zuvyCodingQuestions,
  zuvyPracticeCode,
  zuvyLanguages,
  zuvyTestCases,
  zuvyTestCasesSubmission
} from '../../../drizzle/schema';
import { generateTemplates } from '../../helpers/index';
import { STATUS_CODES } from "../../helpers/index";

const { ZUVY_CONTENT_URL, RAPID_BASE_URL, RAPID_API_KEY, RAPID_HOST } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class CodingPlatformService {
  async submitCodeBatch(sourceCode: SubmitCodeDto, codingOutsourseId: number, action: string): Promise<any> {
    let testCase;
    if ('run' === action) {
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
      if (action == 'submit') {
        input.push(...testCase.inputs.map(input => input.parameterValue));
        output.push(testCase.expectedOutput.parameterValue);
      }
      else if (action == 'run') {
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
      url: `${RAPID_BASE_URL}/submissions/batch`,
      params: {
        base64_encoded: 'true',
        fields: '*'
      },
      headers: {
        'content-type': 'application/json',
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': RAPID_API_KEY,
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
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
      }, 1090));

      if (err) {
        return [err];
      }
      let testSubmission = testCasesArray?.map((testCase, index) => {
        return {
          testcastId: testCase?.id,
          status: submissionInfo.data.submissions[index].status?.description,
          token: submissionInfo.data.submissions[index]?.token,
          stdOut: submissionInfo.data.submissions[index]?.stdout,
          input: testCase?.inputs,
          output: testCase?.expectedOutput
        }
      })
      return [null, { statusCode: STATUS_CODES.OK, message: 'Code submitted successfully', data: testSubmission }];
    } catch (error) {
      return [{ statusCode: STATUS_CODES.BAD_REQUEST, message: error.message }];
    }
  }

  async submitPracticeCode(questionId, sourceCode, action, userId, submissionId, codingOutsourseId): Promise<any> {
    try {
      if (!['run', 'submit'].includes(action.toLowerCase())) {
        return [{ statusCode: STATUS_CODES.BAD_REQUEST, message: 'Invalid action' }];
      }
      let [err, testcasesSubmission] = await this.submitCodeBatch(sourceCode, questionId, action);
      if (err) {
        return [err];
      }
      if (action === 'run') {
        return [null, testcasesSubmission];
      }

      let insertValues: any = { status: 'Accepted' };
      for (let testSub of testcasesSubmission) {
        if (testSub.status !== 'Accepted') {
          insertValues["status"] = testSub.status;
          break;
        }
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

      let testcasesSubmissionInsert = testcasesSubmission.map((testcase) => {
        return {
          submissionId: practiceSubmission[0].id,
          testcastId: testcase.testcastId,
          status: testcase.status,
          token: testcase.token,
        }
      })

      await db.insert(zuvyTestCasesSubmission).values(testcasesSubmissionInsert).returning();

      if (testcasesSubmission.length !== 0) {
        return [null, { statusCode: STATUS_CODES.OK, message: 'Submission successful', testcasesSubmission }];
      } else {
        return [{ statusCode: STATUS_CODES.BAD_REQUEST, message: 'Error in submitting code' }];
      }
    } catch (error) {
      return [{ statusCode: STATUS_CODES.BAD_REQUEST, message: error.message }];
    }
  }


  async getPracticeCode(questionId, userId, submissionId, codingOutsourseId): Promise<any> {
    try {
      let queryString;
      if (isNaN(submissionId)) {
        queryString = sql`${zuvyPracticeCode.questionId} = ${questionId} AND ${zuvyPracticeCode.userId} = ${userId}`
      } else {
        queryString = sql`${zuvyPracticeCode.questionId} = ${questionId} AND ${zuvyPracticeCode.userId} = ${userId} AND ${zuvyPracticeCode.submissionId} = ${submissionId} AND ${zuvyPracticeCode.codingOutsourseId} = ${codingOutsourseId}`
      }
      let response = await db.query.zuvyPracticeCode.findMany({
        where: (zuvyPracticeCode, { sql }) => queryString,
        columns: {
          status: true,
          action: true,
          questionId: true,
          submissionId: true,
        },
      });
      if (response.length === 0) {
        return [{ statusCode: STATUS_CODES.NOT_FOUND, message: 'No practice code available for the given question' }];
      } else {
        let questionInfo = await this.getCodingQuestion(questionId, false);
        const submissionsInfoPromises = response.map(async (submission: any) => {
          const token = submission.token;
          let data = await this.getCodeInfo(token)
          return data;
        });
        const submissions = await Promise.all(submissionsInfoPromises);
        return [null, { statusCode: STATUS_CODES.OK, message: 'Practice code fetched successfully', questionInfo, submissions }];
      }
    } catch (error) {
      return [{ statusCode: STATUS_CODES.BAD_REQUEST, message: error.message }];
    }
  }

  async getSubmissionByQuestionId(questionId: number): Promise<any> {
    try {
      const submissions = await db.query.zuvyPracticeCode.findMany({
        where: (zuvyPracticeCode, { sql }) => sql`${zuvyPracticeCode.questionId} = ${questionId}`,
        columns: {
          id: true,
          status: true,
          action: true,
          questionId: true,
          submissionId: true,
          codingOutsourseId: true,
          createdAt: true,
        },
      });
      if (submissions.length === 0) {
        return [{ message: 'No submission available for the given question', statusCode: STATUS_CODES.NOT_FOUND }];
      }
      return [null, { message: 'All submission by question id', data: submissions, statusCode: STATUS_CODES.OK }];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }



  async getCodeInfo(tokens) {
    const options = {
      method: 'GET',
      url: `${RAPID_BASE_URL}/submissions/batch?tokens=${tokens.join(',')}&base64_encoded=true`,
      params: {
        base64_encoded: 'true',
        fields: '*'
      },
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
      await this.updateTestCaseAndExpectedOutput(testCases);
      return [null, { message: 'Coding question updated successfully', data: question, statusCode: STATUS_CODES.OK }];
    } catch (error) {
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
        },
        with: {
          testCases: {
            columns: {
              id: true,
              inputs: true,
              expectedOutput: true,
            },
            limit: totalCasses == 3 ? totalCasses : undefined,
          }
        }
      })
      if (question.length === 0) {
        return [{ message: 'Not found', statusCode: STATUS_CODES.NOT_FOUND }];
      }

      if (withTemplate) {
        question[0]["templates"] = await generateTemplates(question[0].title, question[0].testCases[0].inputs);
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
      const testCase = await db.insert(zuvyTestCases).values({ questionId, inputs, expectedOutput }).returning();
      return [null, { message: "added the test case", data: testCase[0] }, STATUS_CODES.CREATED];
    } catch (error) {
      return [[{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }]];
    }
  }
}