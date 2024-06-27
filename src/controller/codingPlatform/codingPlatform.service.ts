import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, count, inArray, isNull, desc } from 'drizzle-orm';
// import { BatchesService } from '../batches/batch.service';
import axios from 'axios';
import { SubmitCodeDto,CreateProblemDto } from './dto/codingPlatform.dto';
import * as _ from 'lodash';
import { error, log } from 'console';
import {
  zuvyCodingQuestions,
  zuvyCodingSubmission,
  zuvyPracticeCode
} from '../../../drizzle/schema';

const { ZUVY_CONTENT_URL ,RAPID_API_KEY,RAPID_HOST} = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class CodingPlatformService {
   async submitCode(sourceCode: SubmitCodeDto,questionId:number,action:string) {

    var input = [];
    var output = [];
    const question = await this.getQuestionById(questionId);
      const testCases = question[0].testCases;
      let testCasesCount;
      if(action == 'submit')
      {
      testCasesCount = testCases.length;
      input.push(testCasesCount);
      testCases.forEach(testCase => {
        input.push(...testCase.input.flat());
        output.push(...testCase.output.flat());
      });
      }
      else if(action == 'run')
      {
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
  url: 'https://judge0-ce.p.rapidapi.com/submissions',
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
      const response = await axios.request(options);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
  
  async getCodeInfo(token:string) {
    const options = {
  method: 'GET',
  url: `https://judge0-ce.p.rapidapi.com/submissions/${token}`,
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


  async getLanguagesById()
  {
  
const options = {
  method: 'GET',
  url: 'https://judge0-ce.p.rapidapi.com/languages',
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

  async findSubmissionByQuestionId(questionId: number,id:number) {
    try {
       const submissions = await db.select().from(zuvyCodingSubmission)
        .where(sql`${zuvyCodingSubmission.codingOutsourseId} = ${questionId} AND ${zuvyCodingSubmission.userId} = ${id}`)
     
         const questionSolved: any = submissions[0]?.questionSolved;
         var submissionTokens = {token:[]};
         var respond = [];
  
        const getInfoPromises = questionSolved.map(async token => {
            const getInfo = await this.getCodeInfo(token);
            return getInfo;
        });

        const getInfoResults = await Promise.all(getInfoPromises);
        respond.push(...getInfoResults);        
     return {code:200,respond};
    }catch(err) {
        throw err;
    }
  }

  async updateSubmissionWithToken(userId: number, codingOutsourseId: number, token: string,status:string, assessmentSubmissionId = null) {
  try {
    
    const existingSubmission:any = await db.select()
      .from(zuvyCodingSubmission)
      .where(sql`${zuvyCodingSubmission.userId} = ${userId} AND ${zuvyCodingSubmission.codingOutsourseId} = ${codingOutsourseId}`)

    let questionSolved = [];
    let updatedStatus;
    if(status !== 'Accepted')
    {
        status = 'Not Accepted';
    }
    console.log('existingSubmission',existingSubmission);
    if (existingSubmission.length === 0) {
      questionSolved.push(token);
      let questionObj:any = {};
      if (assessmentSubmissionId){
        questionObj = {
          userId: BigInt(userId),
          questionSolved: questionSolved,
          assessmentSubmissionId,
          codingOutsourseId,
          status
        }
      } else {
        questionObj = {
          userId: BigInt(userId),
          questionSolved: questionSolved,
          codingOutsourseId,
          status
        }
      }
      await db.insert(zuvyCodingSubmission)
        .values({...questionObj})
        .returning();
    } else {
        questionSolved = existingSubmission[0]?.questionSolved.push(token)
        console.log('questionSolved',questionSolved)
      if (status === 'Accepted' || existingSubmission[0].status === 'Accepted') {
        updatedStatus = 'Accepted';
      } else {
        updatedStatus = 'Not Accepted';
      }
      await db.update(zuvyCodingSubmission)
        .set({ questionSolved: questionSolved , status: updatedStatus})
        .where(sql`${zuvyCodingSubmission.userId} = ${userId} AND ${zuvyCodingSubmission.codingOutsourseId} = ${codingOutsourseId}`)
    }
  } catch (error) {
    console.error('Error updating submission:', error);
    throw error;
  }
}

async getQuestionsWithStatus(userId: number) {
  try {
    const questions = await db.select() 
      .from(zuvyCodingQuestions)
     
    const userSubmissions = await db.select()
      .from(zuvyCodingSubmission)
      .where(sql`${zuvyCodingSubmission.userId} = ${userId}`)

    const count = userSubmissions.length;
    const response = questions.map(question => ({
      id: question.id.toString(),
      title: question.title,
      status: count !== 0 ? (userSubmissions[0].questionSolved[question.id.toString()]?.status || null):null,
      difficulty: question.difficulty,
    }));

    return response;
  } catch (error) {
    console.error('Error fetching questions with status:', error);
    throw error;
  }
}

async getQuestionById(questionId: number)
{
    try{
      const question = await db.select().from(zuvyCodingQuestions).where(sql`${zuvyCodingQuestions.id} = ${questionId}`)
      if (question.length === 0) {
          return { status: 'error', code: 400, message: "No question available for the given question Id" };
      }
      return question;
    }catch(err)
    {
        throw err;
    }
}


  async createCodingProblem(codingProblem:CreateProblemDto){
      try {
          const newQuestionCreated = await db.insert(zuvyCodingQuestions).values(codingProblem).returning();
          return newQuestionCreated;
      }catch(err)
      {
      throw err;
      }
  }

  async submitPracticeCode(questionId, sourceCode, action, userId){
    try {
      let response:any = await this.submitCode(sourceCode, questionId, action)

      const token = response.token;
      let submissionInfo = await this.getCodeInfo(token);

      const status = submissionInfo.status.description;
      let getSubmissionsRun = await db.select().from(zuvyPracticeCode).where(sql`${zuvyPracticeCode.userId} = ${userId} AND ${zuvyPracticeCode.questionId} = ${questionId}`).orderBy(desc(zuvyPracticeCode.id)).limit(1);;
      let newSubmision;
      if (action.toLowerCase() === 'run') {
        if(getSubmissionsRun.length == 0){
          newSubmision = await db.insert(zuvyPracticeCode).values({token, status, action, userId, questionId}).returning();
        } else {
          newSubmision = await db.update(zuvyPracticeCode).set({ token, status, action}).where(sql`${zuvyPracticeCode.id} = ${getSubmissionsRun[0].id} AND ${zuvyPracticeCode.action} = 'run'`).returning();
        }
        newSubmision[0].userId = parseInt(newSubmision[0].userId);
        return {...submissionInfo, Submision: newSubmision[0]};
      } else {
        if (getSubmissionsRun.length == 0) {
          newSubmision = await db.insert(zuvyPracticeCode).values({ token, status, action, userId, questionId}).returning();
        } else {
          newSubmision = await db.update(zuvyPracticeCode).set({token, status, action}).where(sql`${zuvyPracticeCode.id} = ${getSubmissionsRun[0].id}`).returning();
        }
        newSubmision[0].userId = parseInt(newSubmision[0].userId);
        return {...response,Submision: newSubmision[0]};
      }
    } catch (error) {
      throw error;
    }
  }

  async getPracticeCode( questionId, userId){
    try {
      let response = await db.query.zuvyPracticeCode.findMany({
        where: (zuvyPracticeCode, { sql }) => sql`${zuvyPracticeCode.questionId} = ${questionId} AND ${zuvyPracticeCode.userId} = ${userId}`,
        columns: {
          token: true,
          status: true,
          action: true,
          questionId: true
        }
      })
      if (response.length === 0) {
        return { status: 'error', code: 400, message: "No practice code available for the given question Id" };
      } else {
        let questionInfo = await this.getQuestionById(questionId);
        const submissionsInfoPromises = response.map((submission: any) => {
          const token = submission.questionSolved;
          return this.getCodeInfo(token).then(submissionInfo => ({...submissionInfo}));
        });
        const submissionsInfo = await Promise.all(submissionsInfoPromises);

        return {submissions: submissionsInfo, questionData: questionInfo[0]};
      }
    } catch (error) {
      console.error('Error getting practice code:', error);
      throw error;
    }
  }
  

}