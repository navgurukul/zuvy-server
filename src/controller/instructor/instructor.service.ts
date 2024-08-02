import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { helperVariable } from 'src/constants/helper';
import { eq, sql, inArray, and, desc, arrayContains, notInArray } from 'drizzle-orm';
import axios from 'axios';
import { error, log } from 'console';


const { ZUVY_CONTENT_URL, ZUVY_CONTENTS_API_URL } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class InstructorService {
   async allCourses(userId : number)
   {
    try {
        const data = await db.query.zuvyBatches.findMany({
          where: (batches, { eq }) =>
            eq(batches.instructorId, Number(userId)),
          columns: {
            id:true,
            name:true
          },
          with: {
            bootcampDetail:{
              columns: {
                id:true,
                name:true
              }
            }
          },
        })


        return {
          status:helperVariable.success,
          code: 200,
          message: data.length > 0 ? 'These are the courses' : 'No course found',
          courseList : data
        };
    }
    catch(err)
    {
      Logger.log(`error: ${err.message}`);
      throw err;
    }
   }
}