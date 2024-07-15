import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, count, lte, desc } from 'drizzle-orm';
// import { BatchesService } from '../batches/batch.service';
import axios from 'axios';
import { SubmitCodeDto, CreateProblemDto } from './dto/codingPlatform.dto';
import * as _ from 'lodash';
import { error, log } from 'console';
import {
  zuvyCodingQuestions,
  zuvyPracticeCode
} from '../../../drizzle/schema';
import { relativeTimeRounding } from 'moment-timezone';

const { ZUVY_CONTENT_URL,RAPID_BASE_URL, RAPID_API_KEY, RAPID_HOST } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class CodingPlatformService {
  async submitPracticeCode(questionId, sourceCode, action, userId, submissionId, codingOutsourseId) {
    try {
      if (!['run', 'submit'].includes(action.toLowerCase())) {
        return { statusCode: 400, message: 'Invalid action' };
      }
      let {submissionInfo, token, status }= await this.submitCode(sourceCode, questionId, action);
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

      if (getSubmissionsRun.length === 0) {
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
        let questionInfo = await this.getQuestionById(questionId);
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
    const question = await this.getQuestionById(codingOutsourseId);
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
      let status = 0;
      let response, token, submissionInfo
      response = await axios.request(options);
      token = response.data.token;
      while (status < 3) {
        submissionInfo = await this.getCodeInfo(token);
        status = submissionInfo.status_id
      }
      status = submissionInfo.status.description
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


  async getLanguagesById() {

    const options = {
      method: 'GET',
      url: `${RAPID_BASE_URL}/languages`,
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

  async getQuestionById(questionId: number) {
    try {
      const question = await db.select().from(zuvyCodingQuestions).where(sql`${zuvyCodingQuestions.id} = ${Number(questionId)}`)
      if (question.length === 0) {
        return { status: 'error', code: 400, message: "No question available for the given question Id" };
      }
      const processedQuestion = question.map(q => ({
        ...q,
        id: Number(q.id)
      }));

      return processedQuestion;

    } catch (err) {
      throw err;
    }
  }


  async createCodingProblem(codingProblem: CreateProblemDto) {
    try {
      const newQuestionCreated = await db.insert(zuvyCodingQuestions).values(codingProblem).returning();
      return newQuestionCreated;
    } catch (err) {
      throw err;
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
      `).limit(1);
      console.log('results:', results)
      if (results.length === 0) {
        return { status: 'error', code: 400, message: "Submission or not Accepted or not submitted yet" };
      }
      let shapecode = await this.getCodeInfo(results[0].token)
      return {...results[0], shapecode}
    } catch (error){
      throw error
    }

  }
}