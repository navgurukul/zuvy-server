import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { helperVariable } from 'src/constants/helper';
import { eq, sql, inArray, and, ilike, or } from 'drizzle-orm';
import { zuvyBatches, zuvySessions } from 'drizzle/schema';
import { STATUS_CODES } from 'src/helpers';

const { ZUVY_CONTENT_URL, ZUVY_CONTENTS_API_URL } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class InstructorService {
  async allCourses(userId: number): Promise<any> {
    try {
      const data = await db.query.zuvyBootcamps.findMany({
        columns: {
          id: true,
          name: true,
          coverImage: true,
        },
        with: {
          batches: {
            columns: {
              id: true,
              name: true,
              instructorId: true,
            },
            where: (batches, { eq }) => eq(batches.instructorId, userId),
          },
        },
        where: (bootcamps, { exists, and, eq }) =>
          exists(
            db
              .select()
              .from(zuvyBatches)
              .where(
                and(
                  eq(zuvyBatches.instructorId, userId),
                  eq(zuvyBatches.bootcampId, bootcamps.id),
                ),
              ),
          ),
      });

      if (data.length > 0) {
        return [
          null,
          {
            message: 'Batches of the instructor has been fetched successfully',
            statusCode: STATUS_CODES.OK,
            data,
          },
        ];
      } else {
        return [
          {
            message: 'No course or batch found',
            statusCode: STATUS_CODES.NO_CONTENT,
          },
          null,
        ];
      }
    } catch (error) {
      return [
        { message: error.message, statusCode: STATUS_CODES.BAD_REQUEST },
        null,
      ];
    }
  }

  async getAllUpcomingClasses(
    instructorId: number,
    limit: number,
    offset: number,
    timeFrame: string,
    batchId: number[],
  ): Promise<any> {
    try {
      const responses = {
        upcoming: [],
        ongoing: [],
      };
      let queryString;
      if (batchId.length > 0) {
        queryString = sql`${zuvyBatches.instructorId} = ${instructorId} AND ${inArray(zuvyBatches.id, batchId)}`;
      } else {
        queryString = sql`${zuvyBatches.instructorId} = ${instructorId}`;
      }
      const batches = await db.select().from(zuvyBatches).where(queryString);
      if (batches.length === 0) {
        return [
          { message: 'Not found', statusCode: STATUS_CODES.NOT_FOUND },
          null,
        ];
      }
      const batchIds = batches.map((batch) => batch.id);
      const batchMap = new Map(batches.map((batch) => [batch.id, batch.name]));
      const currentTime = new Date();

      const classDetails = await db.query.zuvySessions.findMany({
        where: (session) =>
          and(
            inArray(session.batchId, batchIds),
            or(
              eq(session.status, helperVariable.upcoming),
              eq(session.status, helperVariable.ongoing),
            ),
          ),
        with: {
          bootcampDetail: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      const ongoingClasses = [];
      const upcomingClasses = [];

      for (const classObj of classDetails as any[]) {
        const startTime = new Date(classObj.startTime);
        const endTime = new Date(classObj.endTime);
        const { bootcampDetail, ...rest } = classObj;
        const formattedClass = {
          ...rest,
          bootcampName: bootcampDetail?.name,
          batchId: classObj.batchId,
          batchName: batchMap.get(classObj.batchId) || '',
        };

        if (currentTime >= startTime && currentTime <= endTime) {
          ongoingClasses.push({
            ...formattedClass,
            status: helperVariable.ongoing,
          });
        } else if (currentTime < startTime) {
          upcomingClasses.push(formattedClass);
        }
      }

      let filteredUpcomingClasses;
      switch (timeFrame) {
        case '1 week':
          filteredUpcomingClasses = upcomingClasses.filter((classObj) => {
            const startTime = new Date(classObj.startTime);
            return (
              startTime <=
              new Date(currentTime.getTime() + 7 * 24 * 60 * 60 * 1000)
            );
          });
          break;
        case '2 weeks':
          filteredUpcomingClasses = upcomingClasses.filter((classObj) => {
            const startTime = new Date(classObj.startTime);
            return (
              startTime <=
              new Date(currentTime.getTime() + 14 * 24 * 60 * 60 * 1000)
            );
          });
          break;
        default:
          filteredUpcomingClasses = upcomingClasses;
          break;
      }

      filteredUpcomingClasses.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
      ongoingClasses.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );

      responses.upcoming = filteredUpcomingClasses.slice(
        offset,
        limit + offset,
      );
      responses.ongoing = ongoingClasses;

      const totalClasses =
        filteredUpcomingClasses.length + ongoingClasses.length;

      return [
        null,
        {
          message:
            'Upcoming and ongoing classes has been fetched for the instructor',
          statusCode: STATUS_CODES.OK,
          data: {
            responses,
            totalUpcomingClasses: totalClasses,
            totalUpcomingPages:
              totalClasses > 0 ? Math.ceil(totalClasses / limit) : 1,
          },
        },
      ];
    } catch (error) {
      return [
        { message: error.message, statusCode: STATUS_CODES.BAD_REQUEST },
        null,
      ];
    }
  }

  async getBatchOfInstructor(instructorId: number): Promise<any> {
    try {
      const batchDetails = await db
        .select({ batchId: zuvyBatches.id, batchName: zuvyBatches.name })
        .from(zuvyBatches)
        .where(eq(zuvyBatches.instructorId, instructorId));

      if (batchDetails.length > 0) {
        return [
          null,
          {
            message: 'Batches of the instructor has been fetched successfully',
            statusCode: STATUS_CODES.OK,
            data: batchDetails,
          },
        ];
      } else {
        return [
          { message: 'No batch found', statusCode: STATUS_CODES.NO_CONTENT },
          null,
        ];
      }
    } catch (error) {
      Logger.log(`error: ${error.message}`);
      return [
        { message: error.message, statusCode: STATUS_CODES.BAD_REQUEST },
        null,
      ];
    }
  }

  async getAllCompletedClasses(
    instructorId: number,
    limit: number,
    offset: number,
    weeks: number,
    sortBy: string,
    batchId: number[],
    searchTitle: string,
  ): Promise<any> {
    try {
      let startDate: string | undefined;
      if (weeks > 0) {
        const startDateObj = new Date();
        startDateObj.setDate(startDateObj.getDate() - weeks * 7);
        startDate =
          new Date(
            startDateObj.getTime() - startDateObj.getTimezoneOffset() * 60000,
          )
            .toISOString()
            .slice(0, -1) + '+05:30';
      }
      let batches = batchId;
      if (batches.length == 0) {
        const instructorBatch = await db
          .select({ batchId: zuvyBatches.id })
          .from(zuvyBatches)
          .where(eq(zuvyBatches.instructorId, instructorId));
        batches = instructorBatch.map((batch) => batch.batchId);
        if (batches.length == 0) {
          return [
            null,
            {
              message: 'No batches found',
              statusCode: STATUS_CODES.NOT_FOUND,
              data: [],
            },
          ];
        }
      }
      const classDetails = await db.query.zuvySessions.findMany({
        where: (sessions, { lt, gte }) =>
          and(
            lt(sessions.endTime, helperVariable.currentISOTime),
            startDate ? gte(sessions.endTime, startDate) : undefined,
            inArray(sessions.batchId, batches),
            searchTitle ? ilike(sessions.title, `${searchTitle}%`) : undefined,
          ),
        orderBy: (sessions, { asc, desc }) =>
          sortBy === 'asc' ? asc(sessions.startTime) : desc(sessions.startTime),
        with: {
          bootcampDetail: {
            columns: {
              id: true,
              name: true,
            },
          },
          batches: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
        extras: {
          totalCount: sql<number>`coalesce(count(*) over(), 0)`.as(
            'total_count',
          ),
        },
        limit,
        offset,
      });
      if (classDetails.length == 0) {
        return [
          null,
          {
            message: 'No classes found',
            statusCode: STATUS_CODES.OK,
            data: [],
          },
        ];
      }
      const totalCompletedClass =
        classDetails.length > 0 ? Number(classDetails[0]['totalCount']) : 0;
      const totalPages = Math.ceil(totalCompletedClass / limit);
      return [
        null,
        {
          message: 'Completed classes fetched successfully',
          statusCode: STATUS_CODES.OK,
          data: {
            classDetails,
            totalPages,
            currentPage: offset / limit + 1,
            totalCompletedClass,
          },
        },
      ];
    } catch (error) {
      return [
        { message: error.message, statusCode: STATUS_CODES.BAD_REQUEST },
        null,
      ];
    }
  }
}
