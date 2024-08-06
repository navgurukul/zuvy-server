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
  zuvyTestCases
} from '../../../drizzle/schema';
import { generateTemplates } from '../../helpers/index'
import  ErrorResponse  from '../../errorHandler/handler';
import { STATUS_CODES } from "../../helpers/index";

const { ZUVY_CONTENT_URL,RAPID_BASE_URL, RAPID_API_KEY, RAPID_HOST } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class CodingPlatformService {
  async submitPracticeCode(questionId, sourceCode, action, userId, submissionId, codingOutsourseId) {
    try {
      if (!['run', 'submit'].includes(action.toLowerCase())) {
        return { statusCode: 400, message: 'Invalid action' };
      }
      let {submissionInfo, token, status }= await this.submitCode(sourceCode, questionId, action);
  
      if (status !== 'Accepted') {
        return { statusCode: 407, message: status, data: submissionInfo};
      }
      
      let insertValues:any = { token, status, action, userId, questionId };
      let getSubmitQuery;

      if (!Number.isNaN(submissionId)) {
        getSubmitQuery = sql`${zuvyPracticeCode.userId} = ${userId} AND ${zuvyPracticeCode.submissionId} = ${submissionId} AND ${zuvyPracticeCode.codingOutsourseId} = ${codingOutsourseId}`;
        insertValues["submissionId"] = submissionId;
        insertValues["codingOutsourseId"] = codingOutsourseId
      } else {
        getSubmitQuery = sql`${zuvyPracticeCode.userId} = ${userId} AND ${zuvyPracticeCode.questionId} = ${questionId}`;
      }

      let getSubmissionsRun = await db
        .select()
        .from(zuvyPracticeCode)
        .where(getSubmitQuery)
        .orderBy(desc(zuvyPracticeCode.id))
        .limit(1);

      let newSubmission;
      let updateValues:any = { token, status, action };

      if (getSubmissionsRun.length === 0 ) {
        // Insert if no previous submission exists
        newSubmission = await db.insert(zuvyPracticeCode).values(insertValues).returning();
      } else {
        // Update or Insert based on the action of the last submission
        if (getSubmissionsRun[0].action === 'run') {
          newSubmission = await db
            .update(zuvyPracticeCode)
            .set(updateValues)
            .where(sql`${zuvyPracticeCode.id} = ${getSubmissionsRun[0].id}`)
            .returning();
        } else {
          newSubmission = await db.insert(zuvyPracticeCode).values(insertValues).returning();
        }
      }

      if (newSubmission.length !== 0) {
        return { statusCode: 200, message: 'Submission successful', data: submissionInfo  };
      } else {
        return { statusCode: 500, message: 'Error in submitting code' };
      }
    } catch (error) {
        throw error;
    }
  }
  

  async getPracticeCode(questionId, userId, submissionId, codingOutsourseId) {
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
          token: true,
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

  async submitCode(sourceCode: SubmitCodeDto, codingOutsourseId: number, action: string) {

    var input = [];
    var output = [];
    const question = await this.getCodingQuestion(codingOutsourseId, false);
    const testCases = question[0].testCases;
    let testCasesCount;
    if (action == 'submit') {
      testCasesCount = testCases.length;
      input.push(testCasesCount);
      testCases.forEach(testCase => {
        input.push(...testCase.input.flat());
        output.push(...testCase.output.flat());
      });
    }
    else if (action == 'run') {
      testCasesCount = 1;
      input.push(testCasesCount);
      input.push(...testCases[0].input)
      output.push(testCases[0].output)
    }

    const stdinput = input.map(item => item.toString()).join('\n');
    const encodedStdInput = Buffer.from(stdinput).toString('base64')
    const stdoutput = output.map(item => item.toString()).join('\n');
    const encodedStdOutput = Buffer.from(stdoutput).toString('base64');
    const options = {
      method: 'POST',
      url: `${RAPID_BASE_URL}/submissions`,
      params: {
        base64_encoded: 'true',
        fields: '*'
      },
      headers: {
        'content-type': 'application/json',
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': RAPID_API_KEY,
        'X-RapidAPI-Host': RAPID_HOST
      },
      data: {
        language_id: sourceCode.languageId,
        source_code: sourceCode.sourceCode,
        stdin: encodedStdInput,
        expected_output: encodedStdOutput
      }
    };

    try {
      let status_code = 0;
      let response, token, submissionInfo
      response = await axios.request(options);
      token = response.data.token;
      while (status_code < 3) {
        submissionInfo = await this.getCodeInfo(token);
        status_code = submissionInfo.status_id
      }
      let status = submissionInfo.status.description
      return {submissionInfo, token, status };
    } catch (error) {
      throw error;
    }
  }

  async getCodeInfo(token: string) {
    const options = {
      method: 'GET',
      url: `${RAPID_BASE_URL}/submissions/${token}`,
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
              token: true,
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
        token: zuvyPracticeCode.token,
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
      let shapecode = await this.getCodeInfo(results[0].token)
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