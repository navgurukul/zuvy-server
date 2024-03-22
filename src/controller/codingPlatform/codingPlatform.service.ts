import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql ,count} from 'drizzle-orm';
// import { BatchesService } from '../batches/batch.service';
import axios from 'axios';
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

const { ZUVY_CONTENT_URL } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class CodingPlatformService {
   async submitCode(sourceCode: string) {
    console.log(sourceCode)
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
    'X-RapidAPI-Key': '994e54529fmsh71160e73892fd3bp18d8fcjsnea8f41812258',
    'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
  },
  data: {
    language_id: 52,
    source_code: sourceCode
  }
};

    try {
      const response = await axios.request(options);
      console.log(response.data);
      return response.data;
    } catch (error) {
      throw error;
    }
  } 
}