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
import { generateTemplates } from '../../helpers/index'
import { ErrorResponse } from '../../errorHandler/handler';
import { STATUS_CODES } from "../../helpers/index";

const { ZUVY_CONTENT_URL,RAPID_BASE_URL, RAPID_API_KEY, RAPID_HOST } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class CodingPlatformService {
  async submitPracticeCode(questionId, sourceCode, action, userId, submissionId, codingOutsourseId): Promise<any> {
    try {
      if (!['run', 'submit'].includes(action.toLowerCase())) {
        return { statusCode: 400, message: 'Invalid action' };
      }
      let [err, testcasesSubmission] = await this.submitCodeBatch(sourceCode, questionId, action);
      if (err) {
        return [err];
      }
      if (action === 'run') {

        return [null, { statusCode: 200, message: 'Code run successful', testcasesSubmission }];
      }
      let insertValues:any = { status: 'Accepted' };
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
      let practiceSubmission =  await db.insert(zuvyPracticeCode).values(insertValues).returning();
      
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
        return [null, { statusCode: STATUS_CODES.OK, message: 'Submission successful', testcasesSubmission  }];
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
          submissionId: true
        }
      })
      if (response.length === 0) {
        return { status: 'error', code: 400, message: "No practice code available for the given question Id" };
      } else {
        let questionInfo = await this.getCodingQuestion(questionId, false);
        const submissionsInfoPromises = response.map( async (submission: any) => {
          const token = submission.token;
          let data = await this.getCodeInfo(token)          
          return data;
        });        
        const submissions = await Promise.all(submissionsInfoPromises);
        return { ...questionInfo[0], submissions };
      }
    } catch (error) {
      console.error('Error getting practice code:', error);
      throw error;
    }
  }

  async submitCodeBatch(sourceCode: SubmitCodeDto, codingOutsourseId: number, action: string): Promise<any> {
    const [error, question] = await this.getCodingQuestion(codingOutsourseId, false);
    if(error){
      return [error];
    }
    const preparedSubmissions = question.testCases.map((testCase) => {
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
      const tokens = response.data.map(submission => submission.token);
      let submissionInfo;

      await new Promise<void>(resolve => setTimeout(async () => {
        submissionInfo = await this.getCodeInfo(tokens);
        resolve();
      }, 900));
    
      let testSubmission = question.testCases?.map((testCase, index) => {
        return {
          testcastId: testCase?.id,
          status: submissionInfo.submissions[index].status?.description,
          token: submissionInfo.submissions[index]?.token,
        }
      })
      return [null, testSubmission];
    } catch (error) {
      return [{ statusCode: STATUS_CODES.BAD_REQUEST, message: error.message }];
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
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getQuestionsWithStatus(userId: number, difficulty: string, page: number, limit: number) {
    try {

      let queryString 
      if (difficulty !== undefined) {
        if (!['easy', 'medium', 'hard'].includes(difficulty.toLowerCase())) {
          return { status: 'error', code: 400, message: 'Invalid difficulty level' };
        }
        queryString = sql`${zuvyCodingQuestions.difficulty} = ${difficulty}`;
      } else {
        if (difficulty !== undefined) {
          queryString = sql`${zuvyCodingQuestions.difficulty} = ${difficulty}`;
        } else {
          queryString = sql`${zuvyCodingQuestions.id} > 0`;
        }
      }
      const toatalQuestionsWithSubmisionStatus = await db.query.zuvyCodingQuestions.findMany({
        where : queryString,
        limit: limit,
        offset: (page - 1) * limit,
        orderBy: desc(zuvyCodingQuestions.id),
        columns: {
          id: true,
          difficulty: true,
          title: true,
        },
        with: {
          submissions: {
            where: (zuvyPracticeCode, { sql }) => sql`${zuvyPracticeCode.userId} = ${userId} `,
            columns: {
              status: true,
              createdAt: true,
              questionId:true,
            }
          }
        },
      })
      const toatalQuestions = await db.query.zuvyCodingQuestions.findMany({columns: {id: true,}, where: queryString})

      const response = toatalQuestionsWithSubmisionStatus.map((question: any) => {
        const acceptedSubmission = question.submissions.find(submission => submission.status === 'Accepted');
        if (acceptedSubmission) {
          question.SolutionStatus = 'Accepted';
        }
        if (!question.hasOwnProperty('SolutionStatus')) {
          question.SolutionStatus = question.submissions.length > 0 ? question.submissions[question.submissions.length - 1].status : 'No Submission';
        }
        delete question.submissions
        return {
          ...question
        }
      })
      return {toatalQuestionsWithSubmisionStatus, totalQuestions: toatalQuestions.length};
    } catch (error) {
      console.error('Error fetching questions with status:', error);
      throw error;
    }
  }


  async createCodingProblem(codingProblem: CreateProblemDto) {
    try {
      const newQuestionCreated = await db.insert(zuvyCodingQuestions).values(codingProblem).returning();
      return newQuestionCreated;
    } catch (err) {
      return new ErrorResponse(err.message, STATUS_CODES.BAD_REQUEST, false);
    }
  }

  async codingSubmission(userId:number , codingOutsourseId:number){
    try{
      let results = await db.select({
        id: zuvyPracticeCode.id,
        status: zuvyPracticeCode.status,
        action: zuvyPracticeCode.action,
        questionId: zuvyPracticeCode.questionId,
        codingOutsourseId: zuvyPracticeCode.codingOutsourseId,
        submissionId: zuvyPracticeCode.submissionId,
        createdAt: zuvyPracticeCode.createdAt,
      }).from(zuvyPracticeCode).where(sql`
        ${zuvyPracticeCode.codingOutsourseId} = ${codingOutsourseId}
        AND ${zuvyPracticeCode.userId} = ${userId}
        AND ${zuvyPracticeCode.status} = 'Accepted'
        AND ${zuvyPracticeCode.action} = 'submit'
      `).limit(1).orderBy(desc(zuvyPracticeCode.id));

      let data;
      if (results?.length === 0) {
        return { status: 'error', code: 400, message: "Submission or not Accepted or not submitted yet" };
      } else {
        data = await db.select().from(zuvyCodingQuestions).where(sql`${zuvyCodingQuestions.id} = ${results[0].questionId}`)
      }
      let shapecode = await this.getCodeInfo(results[0])
      return {...results[0], questionInfo: data[0], shapecode}
    } catch (error){
      return new ErrorResponse(error.message, STATUS_CODES.BAD_REQUEST, false);
    }
  }
  async getLanguagesById(languageId: number) {
    try {
      const language = await db.select().from(zuvyLanguages).where(sql`${zuvyLanguages.id} = ${languageId}`);
      return language;
    } catch (error) {
      return new ErrorResponse(error.message, STATUS_CODES.BAD_REQUEST, false);
    }
  }

  async createCodingQuestion(createCodingQuestionDto: any): Promise<any> {
    console.log({createCodingQuestionDto});
    const { testCases, ...questionData } = createCodingQuestionDto;
    try {
      const question:any = await db.insert(zuvyCodingQuestions).values(questionData).returning();
      let testCaseAndExpectedOutput = [];
      for (let i = 0; i < testCases.length; i++) {
        testCaseAndExpectedOutput.push({ questionId: question[0].id,inputs: testCases[i].inputs, expectedOutput: testCases[i].expectedOutput});
      }
      let TestCases = await db.insert(zuvyTestCases).values(testCaseAndExpectedOutput).returning();
      return [null,{...question[0], TestCases}];
    } catch (error) {
      return [new ErrorResponse(error.message, STATUS_CODES.BAD_REQUEST, false)];
    }
  }

  async updateCodingQuestion(id: number, updateCodingQuestionDto: any): Promise<any> {
    let { testCases, ...questionData } = updateCodingQuestionDto;
    try {
      const question = await db.update(zuvyCodingQuestions).set(questionData).where(sql`${zuvyCodingQuestions.id} = ${id}`).returning();
      await this.updateTestCaseAndExpectedOutput(testCases);
      return [null, { message: 'Coding question updated successfully', question }];
    } catch (error) {
      return [new ErrorResponse(error.message, STATUS_CODES.BAD_REQUEST, false)];
    }
  }

  async deleteCodingQuestion(id: number): Promise<any> {
    try {
      let data = await db.delete(zuvyCodingQuestions).where(sql`${zuvyCodingQuestions.id} = ${id}`).returning();
      if (data.length === 0) {
        return [new ErrorResponse('Not found', STATUS_CODES.NOT_FOUND, false)];
      }
      return [null, { message: 'Coding question deleted successfully' }];
    } catch (error) {
      return [new ErrorResponse(error.message, STATUS_CODES.BAD_REQUEST, false)];
    }
  }

  async createLanguage(createLanguageDto: any): Promise<any> {
    try {
      const language = await db.insert(zuvyLanguages).values(createLanguageDto);
      return language;
    } catch (error) {
      return new ErrorResponse(error.message, STATUS_CODES.BAD_REQUEST, false);
    }
  }

  async getCodingQuestion(id: number, withTemplate:boolean = true): Promise<any> {
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
            limit: 3
          }
        }
      }) 

      if (question.length === 0) {
        return { status: 'error', code: 400, message: "No question available for the given question Id" };
      }

      if (withTemplate) {
        question[0]["templates"] = await generateTemplates(question[0].title, question[0].testCases[0].inputs);
      }
      
      return [null, question[0]];
    } catch (error) {
      return [new ErrorResponse(error.message, STATUS_CODES.BAD_REQUEST, false)];
    }
  }
  // i want to update the test case and expected output for the coding question
  async updateTestCaseAndExpectedOutput(testcases: any): Promise<any> {
    try {
      testcases.forEach(async (testCase) => {
        const { inputs, expectedOutput } = testCase;
        await db.update(zuvyTestCases).set({ inputs, expectedOutput }).where(sql`${zuvyTestCases.id} = ${testCase.id}`);
      })
      return [null, { message: 'Test case and expected output updated successfully' }];
    } catch (error) {
      return [new ErrorResponse(error.message, STATUS_CODES.BAD_REQUEST, false)];
    }
  }


  async deleteCodingTestcase(id: number) : Promise<any> {
    try {
      let data = await db.delete(zuvyTestCases).where(sql`${zuvyTestCases.id} = ${id}`).returning();
      if (data.length === 0) {
        return [new ErrorResponse('Not found', STATUS_CODES.NOT_FOUND, false)];
      }
      return [null, { message: 'Test case deleted successfully' }];
    } catch (error) {
      return [new ErrorResponse(error.message, STATUS_CODES.BAD_REQUEST, false)];
    }
  }

  async addTestCase(questionId, updateTestCaseDto): Promise<any> {
    try {
      const { inputs, expectedOutput } = updateTestCaseDto
      const testCase = await db.insert(zuvyTestCases).values({ questionId, inputs, expectedOutput }).returning();
      return [null, { message: "added the test case" , data:testCase[0]}];
    } catch (error) {
      return [new ErrorResponse(error.message, STATUS_CODES.BAD_REQUEST, false)];
    }
  }
}