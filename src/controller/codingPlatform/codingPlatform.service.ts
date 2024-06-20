import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql ,count, lte} from 'drizzle-orm';
// import { BatchesService } from '../batches/batch.service';
import axios from 'axios';
import { SubmitCodeDto,CreateProblemDto } from './dto/codingPlatform.dto';
import * as _ from 'lodash';
import { error, log } from 'console';
import {
  zuvyCodingQuestions,
  zuvyCodingSubmission
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
        .where(sql`${zuvyCodingSubmission.questionId} = ${questionId} AND ${zuvyCodingSubmission.userId} = ${id}`)
     
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

  async updateSubmissionWithToken(userId: number, questionId: number, token: string,status:string, assessmentSubmissionId = null) {
  try {
    
    const existingSubmission:any = await db.select()
      .from(zuvyCodingSubmission)
      .where(sql`${zuvyCodingSubmission.userId} = ${userId} AND ${zuvyCodingSubmission.questionId} = ${questionId}`)

    let questionSolved = [];
    let updatedStatus;
    if(status !== 'Accepted')
    {
        status = 'Not Accepted';
    }
    if (existingSubmission.length === 0) {
      questionSolved.push(token)
      await db.insert(zuvyCodingSubmission)
        .values({
          userId: BigInt(userId),
          questionSolved: questionSolved,
          assessmentSubmissionId,
          questionId,
          status
        })
        .returning();
    } else {
        questionSolved = existingSubmission[0]?.questionSolved.push(token)
      if (status === 'Accepted' || existingSubmission[0].status === 'Accepted') {
        updatedStatus = 'Accepted';
      } else {
        updatedStatus = 'Not Accepted';
      }
      await db.update(zuvyCodingSubmission)
        .set({ questionSolved: questionSolved , status: updatedStatus})
        .where(sql`${zuvyCodingSubmission.userId} = ${userId} AND ${zuvyCodingSubmission.questionId} = ${questionId}`)
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


}