import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql ,count} from 'drizzle-orm';
// import { BatchesService } from '../batches/batch.service';
import axios from 'axios';
import { SubmitCodeDto } from './dto/codingPlatform.dto';
import * as _ from 'lodash';
import { error, log } from 'console';
import {
  bootcamps,
  batches,
  users,
  batchEnrollments,
  classesGoogleMeetLink,
  bootcampTracking,
  bootcampType
} from '../../../drizzle/schema';

const { ZUVY_CONTENT_URL ,RAPID_API_KEY,RAPID_HOST} = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class CodingPlatformService {
   async submitCode(sourceCode: SubmitCodeDto) {
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
    stdin: sourceCode.stdInput,
    expected_output: sourceCode.expectedOutput

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
	//console.log(response.data);
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
}