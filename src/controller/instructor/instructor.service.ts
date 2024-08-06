import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { helperVariable } from 'src/constants/helper';
import { eq, sql, inArray, and, desc, arrayContains, notInArray } from 'drizzle-orm';
import * as _ from 'lodash';
import {
  zuvyBatches,
  zuvySessions
} from 'drizzle/schema';


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


   async getAllUpcomingClasses(
    instructorId: number,
    limit: number,
    offset: number,
    timeFrame: string,
    batchId:number
  ) {
    try {
      const responses = {
        upcoming: [],
        ongoing: [],
      };
      let queryString;
      if(!isNaN(batchId))
        {
          queryString = sql`${zuvyBatches.instructorId} = ${instructorId} AND ${zuvyBatches.id}= ${batchId}`
        }
        else {
          queryString = sql`${zuvyBatches.instructorId} = ${instructorId}`
        }
      const batches = await db
        .select()
        .from(zuvyBatches)
        .where(queryString);

      if (batches.length === 0) {
        return {
          status: helperVariable.error,
          message: 'No batches found for the given instructorId',
        };
      }
      for (const batch of batches) {
        const currentTime = new Date();
         const classDetails = await db.query.zuvySessions.findMany({
          where: (session, { sql }) =>
            sql`${session.batchId} = ${batch.id} AND (${session.status} = ${helperVariable.upcoming} OR ${session.status} = ${helperVariable.ongoing})`,
          with : {
            bootcampDetail : {
              columns : {
                id:true,
                name:true
              }
            }
          }
         }) 
        const sortedClasses = _.orderBy(
          classDetails,
          (classObj) => new Date(classObj.startTime),
          'asc',
        );
        const ongoingClasses = [];
        const upcomingClasses = [];
  
        for (const classObj of sortedClasses) {
          const startTime = new Date(classObj.startTime);
          const endTime = new Date(classObj.endTime);
          if (currentTime >= startTime && currentTime <= endTime) {
            const {status,...rest} = classObj;
            ongoingClasses.push({...rest,status:helperVariable.ongoing});
          } else {
            upcomingClasses.push(classObj);
          }
        }
        const paginatedUpcomingClasses = upcomingClasses.slice(
          offset,limit+offset
        );
        const paginatedOngoingClasses = ongoingClasses.slice(
          offset,limit+offset
        );
        let filteredClasses;
        let filteredOngoingClasses = paginatedOngoingClasses;

        switch (timeFrame) {
          case '1 week':
            filteredClasses = paginatedUpcomingClasses.filter(classObj => {
              const startTime = new Date(classObj.startTime);
              return startTime <= new Date(currentTime.getTime() + 7 * 24 * 60 * 60 * 1000);
            });
            break;
          case '2 weeks':
            filteredClasses = paginatedUpcomingClasses.filter(classObj => {
              const startTime = new Date(classObj.startTime);
              return startTime <= new Date(currentTime.getTime() + 14 * 24 * 60 * 60 * 1000);
            });
            break;
          default:
            filteredClasses = paginatedUpcomingClasses;
            break;
        }

        const batchUpcomingClasses = filteredClasses.map(classObj => {
          const { bootcampDetail, ...rest } = classObj;
          return {
            ...rest, 
            bootcampName: bootcampDetail.name, 
            batchId: batch.id, 
            batchName: batch.name, 
          };
        });

        const batchOngoingClasses = filteredOngoingClasses.map(classObj => {
          const { bootcampDetail, ...rest } = classObj;
          return {
            ...rest, 
            bootcampName: bootcampDetail.name, 
            batchId: batch.id, 
            batchName: batch.name,
          };
        });
        responses.upcoming.push(...batchUpcomingClasses);
        responses.ongoing.push(...batchOngoingClasses);
      }
      responses.upcoming.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      responses.ongoing.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      return {
        status: helperVariable.success,
        message: 'Upcoming classes fetched successfully',
        data: responses,
      };
    } catch (error) {
        Logger.log(`error: ${error.message}`)
        throw error;
    }
  }

  async getBatchOfInstructor(instructorId:number)
  {
    try {
      const batchDetails = await db.select({batchId:zuvyBatches.id,batchName: zuvyBatches.name}).from(zuvyBatches).where(eq(zuvyBatches.instructorId,instructorId));

      if(batchDetails.length > 0)
        {
          return {
            status: helperVariable.success,
            code:200,
            batchDetails
          }
        }
        else {
          return {
            status: helperVariable.error,
            code:201,
            message: 'You are not assigned as an instructor to any batch'
          }
        }
    }
    catch(error)
    {
      Logger.log(`error: ${error.message}`)
    }
  }

}