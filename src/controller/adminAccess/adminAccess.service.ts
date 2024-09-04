import { Injectable, Logger, HttpStatus, BadRequestException } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, count, inArray, or, and, like, desc } from 'drizzle-orm';
import axios from 'axios';
import * as _ from 'lodash';
import { error, log } from 'console';
import {
  zuvyBootcamps,
  zuvyBatches,
  users,
  zuvyBatchEnrollments,
  zuvyBootcampTracking,
  zuvyBootcampType,

  // bootcampsEnrollmentsRelations
} from '../../../drizzle/schema';
import { batch } from 'googleapis/build/src/apis/batch';
import { BootcampService } from '../bootcamp/bootcamp.service';
import { subYears, subMonths, subWeeks, format } from 'date-fns';

const { ZUVY_CONTENT_URL } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

enum DateFilter {
  ONE_YEAR = 1,
  SIX_MONTHS = 2,
  ONE_MONTH = 3,
  ONE_WEEK = 4,
}

@Injectable()
export class AdminAccessService {
  private readonly logger = new Logger(AdminAccessService.name);

  constructor(private readonly bootcampService: BootcampService) { }

  async getUsersWithBatchesAndBootcamps(
    batchId,
    searchTerm: string,
    dateFilter: number | null,
    limit: number,
    offset: number,
  ) {
    try {
      // Call the BootcampService to get all bootcamps
      const [err, bootcampsResponse] = await this.bootcampService.getAllBootcamps(null, null, null);

      if (err) {
        throw new BadRequestException('Failed to fetch bootcamps');
      }

      // Check if the bootcampsResponse has the expected structure
      if (!bootcampsResponse || !Array.isArray(bootcampsResponse.data)) {
        throw new BadRequestException('Invalid response structure from BootcampService');
      }

      // Extract bootcamp IDs from the response
      const bootcampIds = bootcampsResponse.data.map((bootcamp) => bootcamp.id);
      this.logger.log(`Fetched Bootcamp IDs: ${bootcampIds.join(', ')}`);

      // Fetch bootcamps with batches
      const bootcampsWithBatches = await Promise.all(
        bootcampIds.map(async (bootcampId) => {
          const [batchErr, batchesResponse] = await this.bootcampService.getBatchByIdBootcamp(bootcampId, null, null);

          if (batchErr) {
            this.logger.error(`Failed to fetch batches for bootcamp ID ${bootcampId}`);
            throw new BadRequestException(`Failed to fetch batches for bootcamp ID ${bootcampId}`);
          }

          // Return the bootcamp along with its associated batches
          return {
            bootcampId,
            batches: batchesResponse.data,  // Assuming batchesResponse contains a `data` array with batches
          };
        })
      );

      // Fetch students associated with each bootcamp
      const allStudents = await Promise.all(
        bootcampIds.map(async (bootcampId) => {
          const studentsResponse = await this.bootcampService.getStudentsInABootcamp(bootcampId, null, '', 10000, 0);

          // Log the studentsResponse to debug
          this.logger.log(`Students for Bootcamp ID ${bootcampId}:`, studentsResponse);

          if (studentsResponse.status !== 'success' || !Array.isArray(studentsResponse.modifiedStudentInfo)) {
            this.logger.error(`Failed to fetch students for bootcamp ID ${bootcampId}`);
            throw new BadRequestException(`Failed to fetch students for bootcamp ID ${bootcampId}`);
          }

          // Group students by batchId
          const studentsByBatch = studentsResponse.modifiedStudentInfo.reduce((acc, student) => {
            const batchId = student.batchId || 'unassigned'; // Use 'unassigned' for students without a batch
            if (!acc[batchId]) {
              acc[batchId] = [];
            }
            acc[batchId].push(student);
            return acc;
          }, {});

          // Group students by batchId and collect all batchIds for each student
          const studentsByMultipleBatch = studentsResponse.modifiedStudentInfo.reduce((acc, student) => {
            const userId = student.userId;
            const batchId = student.batchId || 'unassigned'; // Use 'unassigned' for students without a batch

            if (!acc[userId]) {
              acc[userId] = {
                ...student,
                batchId: [batchId], // Initialize with an array containing the first batchId
              };
            } else {
              acc[userId].batchId.push(batchId); // Append batchId to the existing array
            }

            return acc;
          }, {});

          // Convert the object back to an array
          const allStudentsOfBootcamp = Object.values(studentsByMultipleBatch);


          return {
            bootcampId,
            // allStudentsOfBootcamp: studentsResponse.modifiedStudentInfo,
            // allStudentsOfBootcamp: studentsByBatch,
            allStudentsOfBootcamp,
          }; // Return modifiedStudentInfo directly
        })
      );

      // Flatten the array of arrays into a single array
      // const flatStudentList = allStudents.flat();

      // Flatten the array of objects into a single array
      const flatStudentList = allStudents.flatMap(({ allStudentsOfBootcamp }) => allStudentsOfBootcamp);


      // Log the combined students list before filtering duplicates
      this.logger.log(`All Students Combined:`, flatStudentList);

      // Remove duplicate students based on userId
      const uniqueStudents = flatStudentList.reduce((acc, student) => {
        if (!acc.find(existingStudent => existingStudent.userId === student.userId)) {
          acc.push(student);
        }
        return acc;
      }, []);

      this.logger.log(`Unique Students:`, uniqueStudents);


      // Flatten the array of objects into a single array
      const studentsWithBatches = allStudents.map(({ bootcampId, allStudentsOfBootcamp }) => ({
        bootcampId,
        studentsByBatch: allStudentsOfBootcamp,
      }));

      // Log the final structure before returning
      this.logger.log(`Students with Batches:`, studentsWithBatches);

      // Flatten the array of objects into a single array
      const studentsWithMultipleBatches = allStudents.map(({ bootcampId, allStudentsOfBootcamp }) => ({
        bootcampId,
        studentsByBatch: allStudentsOfBootcamp,
      }));

      // Log the final structure before returning
      this.logger.log(`Students with Multiple Batches:`, studentsWithMultipleBatches);

      // Filter by search term if provided
      const filteredStudents = searchTerm
        ? flatStudentList.filter(student =>
          Object.values(student).some(value =>
            typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase())
          )
        )
        : flatStudentList;

      // Filter by batchId if provided
      const batchFilteredStudents = batchId
        ? filteredStudents.filter(student => student.batchId.includes(batchId))
        : filteredStudents;

      // Remove duplicate students based on userId
      const uniqueFilteredStudents = batchFilteredStudents.reduce((acc, student) => {
        if (!acc.find(existingStudent => existingStudent.userId === student.userId)) {
          acc.push(student);
        }
        return acc;
      }, []);

      this.logger.log(`Unique Students:`, uniqueFilteredStudents);

      // Fetch the "created at" information for each unique student
      const studentsWithCreatedAt = await Promise.all(
        uniqueFilteredStudents.map(async (student) => {
          // const user = await this.userService.getUserById(student.userId); // Assuming you have a method to get user by ID
          // Fetch the user record from the database
          const userRecords = await db.select().from(users).where(eq(users.id, BigInt(student.userId)));

          // Ensure there is a user record and access the first (and presumably only) entry
          const user = userRecords[0];
          // Convert the createdAt string to a Date object and format it to only show the date
          const createdAtDate = new Date(user.createdAt).toISOString().split('T')[0];


          return {
            ...student,
            // createdAt: user.createdAt, // Add the createdAt field from the user record
            createdAt: createdAtDate,
          };
        })
      );


      this.logger.log(`Start DateFilter: ${dateFilter}`);
      let dateFilteredStudents = studentsWithCreatedAt;

      if (dateFilter !== null) {
        let startDate: string | null = null;
        const currentDate = new Date(); // Today's date
        let startDateObj = new Date(currentDate);

        // Log for debugging
        this.logger.log(`Start DateFilter: ${dateFilter}`);
        if (dateFilter === 0) {
          startDateObj = new Date('1970-01-01');
          // Set to January 1, 1970 for default
        } else if (dateFilter === 1) {
          // 1 year ago
          startDateObj.setFullYear(startDateObj.getFullYear() - 1);
        } else if (dateFilter === 2) {
          // 6 months ago
          startDateObj.setMonth(startDateObj.getMonth() - 6);
        } else if (dateFilter === 3) {
          // 1 month ago
          startDateObj.setMonth(startDateObj.getMonth() - 1);
        } else if (dateFilter === 4) {
          // 1 week ago
          startDateObj.setDate(startDateObj.getDate() - 7);
        }

        // Convert startDateObj to 'yyyy-MM-dd' format
        startDate = startDateObj.toISOString().split('T')[0];

        // Log for debugging
        this.logger.log(`Start Date for Filtering: ${startDate}`);

        dateFilteredStudents = studentsWithCreatedAt.filter(student => {
          this.logger.log(`Comparing Student CreatedAt: ${student.createdAt} with Start Date: ${startDate}`);
          return student.createdAt >= startDate;
        });

        // const dateFilteredStudents = studentsWithCreatedAt.filter(student => {
        //   this.logger.log(`Comparing Student CreatedAt: ${student.createdAt} with Start Date: ${startDate}`);
        //   return student.createdAt >= startDate;
        // });

        // const dateFilteredStudents = startDate
        // ? studentsWithCreatedAt.filter(student => {
        //     this.logger.log(`Comparing Student CreatedAt: ${student.createdAt} with Start Date: ${startDate}`);
        //     return student.createdAt >= startDate;
        //   })
        // : studentsWithCreatedAt;

        this.logger.log(`Filtered Students Count: ${dateFilteredStudents.length}`);
      }
      else {

        return studentsWithCreatedAt;
      }

      const currentPage = !isNaN(limit) && !isNaN(offset) ? offset / limit + 1 : 1;
      const totalPages = !isNaN(limit) ? Math.ceil(dateFilteredStudents.length / limit) : 1;
      return {
        // bootcampsWithBatches,
        // students: uniqueStudents,
        // students: allStudents
        // bootcampsWithBatches,
        // students: studentsWithBatches,
        // students: studentsWithMultipleBatches,
        // allStudents: uniqueStudents,
        // filterdStudents: uniqueFilteredStudents,
        // filteredStudents: studentsWithCreatedAt,
        filteredStudents: dateFilteredStudents,
        currentPage,
        totalPages
      };
    } catch (error) {
      this.logger.error('Failed to fetch bootcamps, batches, or students', error);
      throw new BadRequestException('Failed to fetch bootcamps, batches, or students');
    }
  }






  async getUsersWithBatches() {
    // try {
    //   const enrollments = await db.query.zuvyBatchEnrollments.findMany({
    //     with: {
    //       userEnrollment: true,
    //     },
    //   });

    //   // Explicitly type the enrollments to include userEnrollment
    //   type EnrollmentWithUser = typeof enrollments[0] & { userEnrollment: typeof users };

    //   // Type assertion to help TypeScript understand the shape
    //   return (enrollments as EnrollmentWithUser[]).map(enrollment => enrollment.userEnrollment);
    // } catch (error) {
    //   this.logger.error('Failed to fetch students of the batch', error);
    //   throw new BadRequestException('Failed to fetch students of the batch');
    // }
  }


}