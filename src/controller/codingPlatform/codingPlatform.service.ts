import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import axios from 'axios';
import { SubmitCodeDto, CreateProblemDto } from './dto/codingPlatform.dto';
import * as _ from 'lodash';
import {
  zuvyCodingQuestions,
  zuvyPracticeCode,
  zuvyTestCases,
  zuvyTestCasesSubmission,
} from '../../../drizzle/schema';
import { generateTemplates } from '../../helpers/index';
import { generateCppTemplate } from '../../helpers/cpp/generateCpp';
import { STATUS_CODES } from '../../helpers/index';
import { helperVariable } from 'src/constants/helper';

// Difficulty Points Mapping
let { ACCEPTED, SUBMIT, RUN, WAIT_API_RESPONSE } = helperVariable;
const { RAPID_BASE_URL, RAPID_API_KEY, RAPID_HOST } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class CodingPlatformService {
  formatForJavaStrict(jsData) {
    if (Array.isArray(jsData)) {
      return `[${jsData.map((item) => this.formatForJavaStrict(item)).join(',')}]`;
    } else if (typeof jsData === 'object' && jsData !== null) {
      if (Object.keys(jsData).length === 0) return `{}`;
      return `${Object.entries(jsData)
        .map(([key, value]) => `"${key}":${this.formatForJavaStrict(value)}`)
        .join(',')}`;
    } else {
      return jsData;
    }
  }

  async submitCodeBatch(
    sourceCode: SubmitCodeDto,
    codingOutsourseId: number,
    action: string,
  ): Promise<any> {
    const [error, question] = await this.getCodingQuestion(
      codingOutsourseId,
      undefined,
      false,
    );
    if (error) {
      return [error];
    }
    let testCasesArray = question.data.testCases;
    if (
      !testCasesArray ||
      !Array.isArray(testCasesArray) ||
      testCasesArray.length === 0
    ) {
      return [
        {
          statusCode: STATUS_CODES.BAD_REQUEST,
          message: 'Question has no test cases to execute',
        },
      ];
    }

    const preparedSubmissions = testCasesArray.map((testCase) => {
      // Process inputs based on their data types
      const input = testCase.inputs.map((input) => {
        switch (input.parameterType) {
          case 'int':
          case 'float':
          case 'double':
          case 'str':
          case 'bool':
            return input.parameterValue.toString(); // Convert to string
          case 'arrayOfnum':
          case 'arrayOfStr':
          case 'object':
          case 'jsonType':
            return sourceCode.languageId == 96
              ? this.formatForJavaStrict(input.parameterValue)
              : JSON.stringify(input.parameterValue);
          default:
            throw new Error(`Unsupported input type: ${input.parameterType}`);
        }
      });

      // Process expected output based on its data type
      const output = (() => {
        switch (testCase.expectedOutput.parameterType) {
          case 'int':
          case 'float':
          case 'double':
          case 'str':
          case 'bool':
            return testCase.expectedOutput.parameterValue.toString();
          case 'arrayOfnum':
          case 'arrayOfStr':
          case 'jsonType':
          case 'object':
            return sourceCode.languageId == 96
              ? this.formatForJavaStrict(testCase.expectedOutput.parameterValue)
              : JSON.stringify(testCase.expectedOutput.parameterValue);
          default:
            throw new Error(
              `Unsupported output type: ${testCase.expectedOutput.parameterType}`,
            );
        }
      })();
      // Join inputs with newlines and encode in base64
      const stdinput = input.join('\n');
      const encodedStdInput = Buffer.from(stdinput).toString('base64');

      // Encode expected output in base64
      const encodedStdOutput = Buffer.from(output).toString('base64');

      return {
        language_id: sourceCode.languageId,
        source_code: sourceCode.sourceCode,
        stdin: encodedStdInput,
        expected_output: encodedStdOutput,
      };
    });
    const options = {
      method: 'POST',
      url: `${RAPID_BASE_URL}/submissions/batch?base64_encoded=true&wait=true`,

      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': RAPID_API_KEY,
        'X-RapidAPI-Host': RAPID_HOST,
      },
      data: {
        submissions: preparedSubmissions,
      },
    };

    try {
      const response = await axios.request(options);

      const tokens = response.data?.map((submission) => submission.token);
      if (!tokens || tokens.length === 0) {
        return [
          {
            statusCode: STATUS_CODES.BAD_REQUEST,
            message: 'Failed to create code execution submissions',
          },
        ];
      }

      let submissionInfo: any[] = [];
      const MAX_ATTEMPTS = 30; // 30 attempts * 500ms = 15 seconds max polling deadline
      let attempts = 0;

      do {
        attempts++;
        if (attempts > MAX_ATTEMPTS) {
          Logger.warn(
            `submitCodeBatch polling timed out after ${MAX_ATTEMPTS} attempts for tokens: ${tokens.join(',')}`,
          );
          return [
            {
              statusCode: STATUS_CODES.BAD_REQUEST,
              message: 'Code execution timed out. Please try again.',
            },
          ];
        }

        const getRes = await axios.request({
          method: 'GET',
          url: `${RAPID_BASE_URL}/submissions/batch`,
          params: {
            tokens: tokens.join(','),
            base64_encoded: false,
            fields: [
              'token',
              'status_id',
              'status',
              'stdout',
              'stderr',
              'compile_output',
              'time',
              'memory',
              'language_id',
              'stdin',
              'expected_output',
            ].join(','),
          },
          headers: {
            'X-RapidAPI-Key': RAPID_API_KEY,
            'X-RapidAPI-Host': RAPID_HOST,
          },
        });

        submissionInfo = getRes.data.submissions ?? getRes.data;
        if (
          Array.isArray(submissionInfo) &&
          submissionInfo.some((s) => s.status_id < 3)
        ) {
          await new Promise((r) => setTimeout(r, 500));
        }
      } while (
        Array.isArray(submissionInfo) &&
        submissionInfo.some((s) => s.status_id < 3)
      );

      const testSubmission = testCasesArray?.map((testCase, index) => {
        return {
          testcastId: testCase?.id,
          status: submissionInfo[index]?.status?.description,
          token: submissionInfo[index]?.token,
          stdout: submissionInfo[index]?.stdout,
          stderr: submissionInfo[index]?.stderr,
          memory: submissionInfo[index]?.memory,
          compileOutput: submissionInfo[index]?.compile_output,
          time: submissionInfo[index]?.time,
          stdIn: submissionInfo[index]?.stdin,
          languageId: submissionInfo[index]?.language_id,
          expectedOutput: submissionInfo[index]?.expected_output,
        };
      });

      return [
        null,
        {
          statusCode: STATUS_CODES.OK,
          message: 'Code submitted successfully',
          data: testSubmission,
        },
      ];
    } catch (error) {
      return [{ statusCode: STATUS_CODES.BAD_REQUEST, message: error.message }];
    }
  }

  async submitPracticeCode(
    questionId: number,
    sourceCode,
    action,
    userId,
    submissionId,
    codingOutsourseId,
    chapterId,
  ): Promise<any> {
    try {
      if (![RUN, SUBMIT].includes(action.toLowerCase())) {
        return [
          { statusCode: STATUS_CODES.BAD_REQUEST, message: 'Invalid action' },
        ];
      }
      let [err, testcasesSubmission] = await this.submitCodeBatch(
        sourceCode,
        questionId,
        action,
      );
      if (err) {
        return [err];
      }
      if (
        !testcasesSubmission?.data ||
        !Array.isArray(testcasesSubmission.data) ||
        testcasesSubmission.data.length === 0
      ) {
        return [
          {
            statusCode: STATUS_CODES.BAD_REQUEST,
            message: 'No test case submission results found',
          },
        ];
      }
      if (testcasesSubmission.data[0].stderr && action != SUBMIT) {
        return [
          null,
          {
            statusCode: STATUS_CODES.CONFLICT,
            message: `${action} ${testcasesSubmission.data[0].status}`,
            data: [testcasesSubmission.data[0]],
          },
        ];
      }
      let insertValues;
      if (testcasesSubmission.data.length > 0) {
        insertValues = {
          status: ACCEPTED,
          sourceCode: sourceCode.sourceCode,
          programLangId: sourceCode.languageId,
        };
      } else {
        insertValues = { status: 'Error', sourceCode: sourceCode.sourceCode };
      }

      for (let testSub of testcasesSubmission.data) {
        if (testSub.status !== ACCEPTED) {
          insertValues['status'] = testSub.status;
          break;
        }
      }
      if (action === RUN) {
        // i want to update the last submission sourceCode where last submission sourceCode
        let queryString = sql`${zuvyPracticeCode.questionId} = ${questionId} AND ${zuvyPracticeCode.userId} = ${userId} AND ${zuvyPracticeCode.action} = ${action}`;
        if (submissionId) {
          queryString = sql`${queryString} AND ${zuvyPracticeCode.submissionId} = ${submissionId} AND ${zuvyPracticeCode.codingOutsourseId} = ${codingOutsourseId}`;
        }
        let response = await db.query.zuvyPracticeCode.findMany({
          where: queryString,
          columns: {
            id: true,
            status: true,
          },
        });
        if (response.length === 0) {
          insertValues['userId'] = userId;
          insertValues['questionId'] = questionId;
          insertValues['action'] = action;
          if (submissionId) {
            insertValues['submissionId'] = submissionId;
          }
          if (codingOutsourseId) {
            insertValues['codingOutsourseId'] = codingOutsourseId;
          }
          if (chapterId) {
            insertValues['chapterId'] = chapterId;
          }
          await db.insert(zuvyPracticeCode).values(insertValues).returning();
        } else {
          await db
            .update(zuvyPracticeCode)
            .set(insertValues)
            .where(sql`${zuvyPracticeCode.id} = ${response[0].id}`)
            .returning();
        }
        return [
          null,
          {
            statusCode: STATUS_CODES.OK,
            message: `${action} ${testcasesSubmission.data[0].status}`,
            data: testcasesSubmission.data,
          },
        ];
      }
      insertValues['userId'] = userId;
      insertValues['questionId'] = questionId;
      insertValues['action'] = action;
      if (submissionId) {
        insertValues['submissionId'] = submissionId;
      }
      if (codingOutsourseId) {
        insertValues['codingOutsourseId'] = codingOutsourseId;
      }
      if (chapterId) {
        insertValues['chapterId'] = chapterId;
      }
      let practiceSubmission = await db
        .insert(zuvyPracticeCode)
        .values(insertValues)
        .returning();

      let testcasesSubmissionInsert = testcasesSubmission.data.map(
        (testcase) => {
          return {
            submissionId: practiceSubmission[0].id,
            testcastId: testcase.testcastId,
            status: testcase.status,
            token: testcase.token,
            stdout: testcase.stdout,
            stderr: testcase.stderr,
            memory: testcase.memory,
            time: testcase.time,
            compileOutput: testcase.compileOutput,
            stdIn: testcase.stdIn,
            expectedOutput: testcase.expectedOutput,
            languageId: testcase.languageId,
          };
        },
      );
      let test_Submission = await db
        .insert(zuvyTestCasesSubmission)
        .values(testcasesSubmissionInsert)
        .returning();
      if (test_Submission.length !== 0) {
        return [
          null,
          {
            statusCode: STATUS_CODES.OK,
            message: `${action} ${testcasesSubmission.data[0].status}`,
            data: testcasesSubmissionInsert,
          },
        ];
      } else {
        return [
          {
            statusCode: STATUS_CODES.BAD_REQUEST,
            message: 'Error in submitting code',
          },
        ];
      }
    } catch (error) {
      return [{ statusCode: STATUS_CODES.BAD_REQUEST, message: error.message }];
    }
  }

  async getPracticeCode(
    questionId,
    userId,
    submissionId,
    codingOutsourseId,
    chapterId,
  ): Promise<any> {
    try {
      let queryString;
      if (isNaN(submissionId)) {
        queryString = sql`${zuvyPracticeCode.questionId} = ${questionId} AND ${zuvyPracticeCode.userId} = ${userId} AND ${zuvyPracticeCode.submissionId} IS NULL`;

        // Add chapterId filter if provided
        if (chapterId) {
          queryString = sql`${queryString} AND ${zuvyPracticeCode.chapterId} = ${chapterId}`;
        }
      } else {
        queryString = sql`${zuvyPracticeCode.questionId} = ${questionId} AND ${zuvyPracticeCode.userId} = ${userId} AND ${zuvyPracticeCode.submissionId} = ${submissionId} AND ${zuvyPracticeCode.codingOutsourseId} = ${codingOutsourseId}`;

        // Add chapterId filter if provided
        if (chapterId) {
          queryString = sql`${queryString} AND ${zuvyPracticeCode.chapterId} = ${chapterId}`;
        }
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
          chapterId: true,
          createdAt: true,
          programLangId: true,
          sourceCode: true,
        },
        with: {
          questionDetail: true,
          TestCasesSubmission: {
            with: {
              testCases: true,
            },
          },
        },
        limit: 1,
        orderBy: (zuvyPracticeCode, { sql }) =>
          sql`${zuvyPracticeCode.id} DESC`,
      });

      if (response.length === 0) {
        return [
          {
            statusCode: STATUS_CODES.OK,
            message: 'No practice code available for the given question',
          },
        ];
      } else {
        const practiceCode = response[0];

        // Construct response data with languageId after sourceCode
        const responseData = {
          id: practiceCode.id,
          status: practiceCode.status,
          action: practiceCode.action,
          questionId: practiceCode.questionId,
          submissionId: practiceCode.submissionId,
          codingOutsourseId: practiceCode.codingOutsourseId,
          chapterId: practiceCode.chapterId,
          createdAt: practiceCode.createdAt,
          programLangId: practiceCode.programLangId,
          sourceCode: practiceCode.sourceCode,
          ...(practiceCode.action === 'run' && {
            languageId: Number(practiceCode.programLangId),
          }),
          questionDetail: practiceCode.questionDetail,
          TestCasesSubmission: practiceCode.TestCasesSubmission?.map(
            ({ languageId, ...rest }) => rest,
          ), // Removing languageId from TestCasesSubmission
        };

        return [
          null,
          {
            statusCode: STATUS_CODES.OK,
            message: 'Practice code fetched successfully',
            data: responseData,
          },
        ];
      }
    } catch (error) {
      return [
        {
          statusCode: STATUS_CODES.BAD_REQUEST,
          message: error.message,
        },
      ];
    }
  }

  async getTestCasesSubmission(TestCasesSubmission: any): Promise<any> {
    try {
      const submissionsInfoPromises = TestCasesSubmission.map(
        async (submission: any) => {
          const options = {
            method: 'GET',
            url: `${RAPID_BASE_URL}/submissions/${submission.token}?base64_encoded=false&fields=*`,
            headers: {
              'X-RapidAPI-Key': RAPID_API_KEY,
              'X-RapidAPI-Host': RAPID_HOST,
            },
          };
          const response = await axios.request(options);
          let status = response.data.status?.description;
          return { ...submission, ...response.data, status };
        },
      );
      const submission = await Promise.all(submissionsInfoPromises);
      if (submission.length === 0) {
        return [
          {
            message: 'No submission available for the given submissionId',
            statusCode: STATUS_CODES.NOT_FOUND,
          },
        ];
      }

      return [
        null,
        {
          message: 'All submission by submission id',
          data: submission,
          statusCode: STATUS_CODES.OK,
        },
      ];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  async getCodeInfo(tokens) {
    const options = {
      method: 'GET',
      url: `${RAPID_BASE_URL}/submissions/batch?tokens=${tokens.join(',')}&base64_encoded=false&fields=token,stdout,stderr,status_id,language_id,source_code,status,memory,time,compile_output,expected_output,language_id,stdin`,

      headers: {
        'X-RapidAPI-Key': RAPID_API_KEY,
        'X-RapidAPI-Host': RAPID_HOST,
      },
    };

    try {
      const response = await axios.request(options);
      return [
        null,
        {
          statusCode: STATUS_CODES.OK,
          message: 'Code submitted successfully',
          data: response.data,
        },
      ];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  // token test case sourse code
  async getSourceCodeByToken(token: string): Promise<any> {
    try {
      const options = {
        method: 'GET',
        url: `${RAPID_BASE_URL}/submissions/${token}?base64_encoded=true&fields=source_code,stdout,stderr,status_id,language_id,created_at,finished_at,compile_output,`,
        headers: {
          'X-RapidAPI-Key': RAPID_API_KEY,
          'X-RapidAPI-Host': RAPID_HOST,
        },
      };
      const response = await axios.request(options);
      return [
        null,
        {
          message: 'Code fetched successfully',
          data: response.data,
          statusCode: STATUS_CODES.OK,
        },
      ];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  async createCodingQuestion(
    createCodingQuestionDto: any,
    orgId: number,
  ): Promise<any> {
    const { testCases, ...questionData } = createCodingQuestionDto;
    questionData['usage'] = 0;
    questionData['orgId'] = orgId;

    questionData.title =
      questionData.title?.charAt(0).toUpperCase() +
      questionData.title?.slice(1);

    try {
      const question: any = await db
        .insert(zuvyCodingQuestions)
        .values(questionData)
        .returning();
      let testCaseAndExpectedOutput = [];
      for (let i = 0; i < testCases.length; i++) {
        testCaseAndExpectedOutput.push({
          questionId: question[0].id,
          inputs: testCases[i].inputs,
          expectedOutput: testCases[i].expectedOutput,
        });
      }
      let TestCases = await db
        .insert(zuvyTestCases)
        .values(testCaseAndExpectedOutput)
        .returning();
      // return [null,{...question[0], TestCases}];
      return [
        null,
        {
          message: 'Coding question created successfully',
          data: { ...question[0], TestCases },
          statusCode: STATUS_CODES.CREATED,
        },
      ];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  async updateCodingQuestion(
    id: number,
    updateCodingQuestionDto: any,
    orgId: number,
  ): Promise<any> {
    let { testCases, ...questionData } = updateCodingQuestionDto;
    try {
      const beforeRows = await db
        .select()
        .from(zuvyCodingQuestions)
        .where(
          and(
            eq(zuvyCodingQuestions.id, id),
            eq(zuvyCodingQuestions.orgId, orgId),
          ),
        )
        .limit(1);
      const before = beforeRows[0] || null;

      if (!before) {
        return [
          {
            message: 'Coding question not found or unauthorized',
            statusCode: STATUS_CODES.NOT_FOUND,
          },
        ];
      }

      if (!Array.isArray(testCases) || testCases.length < 2) {
        return [
          {
            message: 'Test case should be minimum 2',
            statusCode: STATUS_CODES.BAD_REQUEST,
          },
        ];
      }

      const result = await db.transaction(async (tx) => {
        const question = await tx
          .update(zuvyCodingQuestions)
          .set(questionData)
          .where(
            and(
              eq(zuvyCodingQuestions.id, id),
              eq(zuvyCodingQuestions.orgId, orgId),
            ),
          )
          .returning();

        let missingIdElements = testCases.filter(
          (element) => !element.hasOwnProperty('id'),
        );
        const existingTestCases = testCases.filter((element) =>
          element.hasOwnProperty('id'),
        );
        missingIdElements = missingIdElements.map((element) => ({
          ...element,
          questionId: id,
        }));

        const existingIds = existingTestCases.map((tc) => tc.id);
        if (existingIds.length > 0) {
          await tx
            .delete(zuvyTestCases)
            .where(
              sql`${zuvyTestCases.questionId} = ${id} AND ${notInArray(
                zuvyTestCases.id,
                existingIds,
              )}`,
            );
        } else {
          await tx
            .delete(zuvyTestCases)
            .where(eq(zuvyTestCases.questionId, id));
        }

        const newAddedTestCases: any[] =
          missingIdElements.length > 0
            ? await tx
                .insert(zuvyTestCases)
                .values(missingIdElements)
                .returning()
            : [];

        const [updateErr] = await this.updateTestCaseAndExpectedOutput(
          existingTestCases,
          tx,
        );
        if (updateErr) {
          throw new Error(updateErr.message);
        }

        return {
          question,
          testCases: [...existingTestCases, ...newAddedTestCases],
        };
      });

      return [
        null,
        {
          message: 'Coding question updated successfully',
          data: result,
          before,
          statusCode: STATUS_CODES.OK,
        },
      ];
    } catch (error) {
      Logger.error(JSON.stringify(error));
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  async deleteCodingQuestion(id: number, orgId: number): Promise<any> {
    try {
      const existingSubmissions = await db
        .select({ id: zuvyPracticeCode.id })
        .from(zuvyPracticeCode)
        .where(eq(zuvyPracticeCode.questionId, id))
        .limit(1);

      if (existingSubmissions.length > 0) {
        return [
          {
            message:
              'Cannot delete coding question with existing student submissions',
            statusCode: STATUS_CODES.BAD_REQUEST,
          },
        ];
      }

      const data = await db
        .delete(zuvyCodingQuestions)
        .where(
          and(
            eq(zuvyCodingQuestions.id, id),
            eq(zuvyCodingQuestions.orgId, orgId),
          ),
        )
        .returning();
      if (data.length === 0) {
        return [{ message: 'Not found', statusCode: STATUS_CODES.NOT_FOUND }];
      }
      return [
        null,
        {
          message: 'Coding question deleted successfully',
          statusCode: STATUS_CODES.OK,
          questionTitle: data[0]?.title,
        },
      ];
    } catch (error) {
      Logger.error(JSON.stringify(error));
      if (error?.code === '23503') {
        return [
          {
            message:
              'Cannot delete coding question because it is referenced by other records',
            statusCode: STATUS_CODES.BAD_REQUEST,
          },
        ];
      }
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  async getCodingQuestion(
    id: number,
    orgId?: number,
    withTemplate: boolean = true,
  ): Promise<any> {
    try {
      const question: any = await db.query.zuvyCodingQuestions.findMany({
        where: (zuvyCodingQuestions, { and, eq }) => {
          const conditions = [eq(zuvyCodingQuestions.id, id)];
          if (orgId) {
            conditions.push(eq(zuvyCodingQuestions.orgId, orgId));
          }
          return and(...conditions);
        },
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
          },
        },
      });

      if (question.length === 0) {
        return [{ message: 'Not found', statusCode: STATUS_CODES.NOT_FOUND }];
      }

      if (withTemplate) {
        let [errorGenerateTemplate, templates] = await generateTemplates(
          question[0].title,
          question[0].testCases[0].inputs,
          question[0].testCases[0].expectedOutput?.parameterType,
          question[0].testCases,
        );
        if (errorGenerateTemplate) {
          return [errorGenerateTemplate];
        }
        question[0]['templates'] = templates;
      }
      return [
        null,
        {
          message: 'Coding question fetched successfully',
          data: question[0],
          statusCode: STATUS_CODES.OK,
        },
      ];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }
  // i want to update the test case and expected output for the coding question
  async updateTestCaseAndExpectedOutput(
    testcases: any,
    tx?: any,
  ): Promise<any> {
    try {
      const dbClient = tx || db;
      for (const testCase of testcases) {
        const { inputs, expectedOutput } = testCase;
        await dbClient
          .update(zuvyTestCases)
          .set({ inputs, expectedOutput })
          .where(sql`${zuvyTestCases.id} = ${testCase.id}`);
      }
      return [
        null,
        {
          message: 'Test case and expected output updated successfully',
          statusCode: STATUS_CODES.OK,
        },
      ];
    } catch (error) {
      Logger.error(JSON.stringify(error));
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  async deleteCodingTestcase(id: number): Promise<any> {
    try {
      const existingTestCase = await db
        .select()
        .from(zuvyTestCases)
        .where(eq(zuvyTestCases.id, id))
        .limit(1);

      if (!existingTestCase || existingTestCase.length === 0) {
        return [{ message: 'Not found', statusCode: STATUS_CODES.NOT_FOUND }];
      }

      const questionId = existingTestCase[0].questionId;
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(zuvyTestCases)
        .where(eq(zuvyTestCases.questionId, questionId));

      const totalTestCases = Number(countResult[0]?.count || 0);
      if (totalTestCases <= 2) {
        return [
          {
            message: 'Test case should be minimum 2, cannot delete further',
            statusCode: STATUS_CODES.BAD_REQUEST,
          },
        ];
      }

      let data = await db
        .delete(zuvyTestCases)
        .where(sql`${zuvyTestCases.id} = ${id}`)
        .returning();
      if (data.length === 0) {
        return [{ message: 'Not found', statusCode: STATUS_CODES.NOT_FOUND }];
      }
      return [
        null,
        {
          message: 'Test case deleted successfully',
          statusCode: STATUS_CODES.OK,
        },
      ];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  async addTestCase(questionId, updateTestCaseDto): Promise<any> {
    try {
      const { inputs, expectedOutput } = updateTestCaseDto;
      let insertTestcase: any = { questionId, inputs, expectedOutput };
      const testCase = await db
        .insert(zuvyTestCases)
        .values(insertTestcase)
        .returning();
      return [
        null,
        {
          message: 'added the test case',
          data: testCase[0],
          statusCode: STATUS_CODES.CREATED,
        },
      ];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  // getTestcasesSubmissionBySubmissionId
  async getTestcasesSubmissionBySubmissionId(
    submissionId: number,
    user: any,
  ): Promise<any> {
    try {
      const userRoles: string[] = Array.isArray(user?.roles) ? user.roles : [];
      const isSuperAdmin = userRoles.includes('super_admin');
      const isInstructorOrAdmin =
        userRoles.includes('admin') ||
        userRoles.includes('instructor') ||
        userRoles.includes('ops');

      const submission = await db.query.zuvyPracticeCode.findMany({
        where: (zuvyPracticeCode, { sql }) =>
          sql`${zuvyPracticeCode.id} = ${submissionId}`,
        columns: {
          id: true,
          userId: true,
          status: true,
          action: true,
          questionId: true,
          submissionId: true,
          codingOutsourseId: true,
          createdAt: true,
          programLangId: true,
          sourceCode: true,
        },
        with: {
          questionDetail: {
            columns: {
              id: true,
              orgId: true,
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
            },
          },
          TestCasesSubmission: true,
        },
      });
      if (submission.length === 0) {
        return [
          {
            message: 'No submission available for the given submissionId',
            statusCode: STATUS_CODES.NOT_FOUND,
          },
        ];
      }

      const sub = submission[0];
      const isOwner = Number(user?.id) === Number(sub.userId);

      if (!isOwner && !isSuperAdmin) {
        if (!isInstructorOrAdmin) {
          return [
            {
              message: 'You are not authorized to view this submission',
              statusCode: STATUS_CODES.FORBIDDEN,
            },
          ];
        }

        if (
          user?.orgId &&
          sub.questionDetail?.orgId &&
          Number(user.orgId) !== Number(sub.questionDetail.orgId)
        ) {
          return [
            {
              message:
                'You are not authorized to view submissions from another organization',
              statusCode: STATUS_CODES.FORBIDDEN,
            },
          ];
        }
      }

      return [
        null,
        {
          message: 'All submission by submission id',
          data: sub,
          statusCode: STATUS_CODES.OK,
        },
      ];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }

  async getSubmissionsId(questionId: number, user: any): Promise<any> {
    try {
      const userRoles: string[] = Array.isArray(user?.roles) ? user.roles : [];
      const isSuperAdmin = userRoles.includes('super_admin');
      const isInstructorOrAdmin =
        userRoles.includes('admin') ||
        userRoles.includes('instructor') ||
        userRoles.includes('ops');

      const question = await db.query.zuvyCodingQuestions.findFirst({
        where: (zuvyCodingQuestions, { eq }) =>
          eq(zuvyCodingQuestions.id, questionId),
        columns: {
          id: true,
          orgId: true,
        },
      });

      if (!question) {
        return [
          {
            message: 'Question not found',
            statusCode: STATUS_CODES.NOT_FOUND,
          },
        ];
      }

      if (isInstructorOrAdmin && !isSuperAdmin) {
        if (
          user?.orgId &&
          question.orgId &&
          Number(user.orgId) !== Number(question.orgId)
        ) {
          return [
            {
              message:
                'You are not authorized to view submissions for this question',
              statusCode: STATUS_CODES.FORBIDDEN,
            },
          ];
        }
      }

      const isPrivileged = isSuperAdmin || isInstructorOrAdmin;
      const whereCondition = isPrivileged
        ? sql`${zuvyPracticeCode.questionId} = ${questionId} AND ${zuvyPracticeCode.action} = ${SUBMIT}`
        : sql`${zuvyPracticeCode.questionId} = ${questionId} AND ${zuvyPracticeCode.action} = ${SUBMIT} AND ${zuvyPracticeCode.userId} = ${user?.id}`;

      const submissions = await db.query.zuvyPracticeCode.findMany({
        where: () => whereCondition,
        columns: {
          id: true,
          status: true,
          action: true,
          questionId: true,
          submissionId: true,
          codingOutsourseId: true,
          chapterId: true,
          createdAt: true,
          programLangId: true,
          sourceCode: true,
        },
        with: {
          questionDetail: true,
        },
      });
      if (submissions.length === 0) {
        return [
          {
            message: 'No submission available for the given questionId',
            statusCode: STATUS_CODES.NOT_FOUND,
          },
        ];
      }
      return [
        null,
        {
          message: 'All submission by question id',
          data: submissions,
          statusCode: STATUS_CODES.OK,
        },
      ];
    } catch (error) {
      return [{ message: error.message, statusCode: STATUS_CODES.BAD_REQUEST }];
    }
  }
}
