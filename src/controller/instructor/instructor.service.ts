import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { helperVariable } from 'src/constants/helper';
import { eq, sql, inArray, and} from 'drizzle-orm';
import * as _ from 'lodash';
import {
  zuvyBatches,
  zuvySessions
} from 'drizzle/schema';
import { STATUS_CODES } from 'src/helpers';


const { ZUVY_CONTENT_URL, ZUVY_CONTENTS_API_URL } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class InstructorService {

   async allCourses(userId : number):Promise<any>
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

        if(data.length > 0)
          {
        return [null,{message:'Batches of the instructor has been fetched successfully',statusCode: STATUS_CODES.OK,data}]
          }
          else {
            return [{message:'No course or batch found', statusCode: STATUS_CODES.NO_CONTENT},null]
          }
    }
    catch(error)
    {
      return [{message:error.message, statusCode: STATUS_CODES.BAD_REQUEST},null]
    }
   }


   async getAllUpcomingClasses(
    instructorId: number,
    limit: number,
    offset: number,
    timeFrame: string,
    batchId:number[]
  ):Promise<any> {
    try {
      const responses = {
        upcoming: [],
        ongoing: [],
      };
      let queryString;
      if(batchId.length > 0)
        {
          queryString = sql`${zuvyBatches.instructorId} = ${instructorId} AND ${inArray(zuvyBatches.id, batchId)}`
        }
        else {
          queryString = sql`${zuvyBatches.instructorId} = ${instructorId}`
        }
      const batches = await db
        .select()
        .from(zuvyBatches)
        .where(queryString);
      if (batches.length === 0) {
        return [{message:'Not found', statusCode: STATUS_CODES.NOT_FOUND},null]
      }
      var upcomingCount = 0;
      var ongoingCount = 0;
      for (const batch of batches) {
        const currentTime = new Date();
         const classDetails = await db.query.zuvySessions.findMany({
          where: (session, { sql }) =>
            sql`${session.batchId} = ${batch.id} 
             AND (${session.status} = ${helperVariable.upcoming} OR ${session.status} = ${helperVariable.ongoing})`,
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
          } else if(currentTime < startTime){
            upcomingClasses.push(classObj);
          }
        }
        upcomingCount = upcomingCount + upcomingClasses.length;
        ongoingCount = ongoingCount + ongoingClasses.length;
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
      const totalClasses = upcomingCount + ongoingCount
      responses.upcoming.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      responses.ongoing.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      return [null,{message: 'Upcoming and ongoing classes has been fetched for the instructor',statusCode:STATUS_CODES.OK,data:{responses,
        totalUpcomingClasses : totalClasses,
        totalUpcomingPages : totalClasses > 0 ?  Math.ceil(totalClasses/limit) : 1}}]
    } catch (error) {
      return [{message:error.message, statusCode: STATUS_CODES.BAD_REQUEST},null]
    }
  }

  async getBatchOfInstructor(instructorId:number):Promise<any>
  {
    try {
      const batchDetails = await db.select({batchId:zuvyBatches.id,batchName: zuvyBatches.name}).from(zuvyBatches).where(eq(zuvyBatches.instructorId,instructorId));

      if(batchDetails.length > 0)
        {
          return [null,{message:'Batches of the instructor has been fetched successfully',statusCode: STATUS_CODES.OK,data:batchDetails}]
        }
        else {
          return [{message:'No batch found', statusCode: STATUS_CODES.NO_CONTENT},null]
        }
    }
    catch(error)
    {
      Logger.log(`error: ${error.message}`)
      return [{message:error.message, statusCode: STATUS_CODES.BAD_REQUEST},null]
    }
  }
  
  async getAllCompletedClasses(instructorId: number,
    limit: number,
    offset: number,
    weeks: number,
    batchId:number[]):Promise<any>
    {
      try {
        const currentDate = new Date();
        let currentISOTime = new Date(currentDate.getTime() - currentDate.getTimezoneOffset() * 60000).toISOString().slice(0, -1) + '+05:30';
        let startDate: string | undefined;
        if (weeks > 0) {
        const startDateObj = new Date();
        startDateObj.setDate(startDateObj.getDate() - (weeks * 7));
        startDate = new Date(startDateObj.getTime() - startDateObj.getTimezoneOffset() * 60000).toISOString().slice(0, -1) + '+05:30';
         }
         let batches = batchId;
         if(batches.length == 0)
          {
             const instructorBatch = await db.select({batchId:zuvyBatches.id}).from(zuvyBatches).where(eq(zuvyBatches.instructorId,instructorId));
             batches = instructorBatch.map(batch => batch.batchId);
             if(batches.length == 0)
              {
                return [null,{message:'No batches found',statusCode: STATUS_CODES.NOT_FOUND,data:null}]
              }
          }
        const classDetails = await db.query.zuvySessions.findMany({
          where: (sessions, { lt, gte }) =>and( lt(sessions.endTime, currentISOTime), startDate ? gte(sessions.endTime, startDate) : undefined,inArray(sessions.batchId,batches) ),
          orderBy: (sessions, { desc }) => desc(sessions.startTime),
          with : {
            bootcampDetail : {
              columns : {
                id:true,
                name:true
              }
            },
            batches: {
              columns: {
                id:true,
                name:true
              }
            }
          },
          extras: {
            totalCount: sql<number>`coalesce(count(*) over(), 0)`.as('total_count')
          },
          limit,
          offset
         })
        if(classDetails.length == 0)
          {
            return [null,{message:'No classes found',statusCode: STATUS_CODES.NOT_FOUND,data:null}]
          }
        const totalCompletedClass =  classDetails.length > 0 ? Number(classDetails[0]['totalCount']) : 0;
        const totalPages = Math.ceil(totalCompletedClass/limit);
        return [null,{message:'Completed classes fetched successfully',statusCode: STATUS_CODES.OK,data:{classDetails,totalPages,currentPage : (offset/limit)+1, totalCompletedClass}}]

      }catch(error)
      {
        return [{message:error.message, statusCode: STATUS_CODES.BAD_REQUEST},null]
      }
    }
}