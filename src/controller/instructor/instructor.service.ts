import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, inArray, and, desc, arrayContains, notInArray } from 'drizzle-orm';
import axios from 'axios';
import { error, log } from 'console';
import {
  zuvyAssignmentSubmission,
  zuvyChapterTracking,
  zuvyModuleChapter,
  zuvyModuleQuiz,
  zuvyQuizTracking,
  zuvyModuleTracking,
  zuvyBootcampTracking,
  zuvyCourseModules,
  zuvyBatchEnrollments,
  zuvyBatches,
  users,
  zuvyProjectTracking,
  zuvyRecentBootcamp,
  zuvyAssessmentSubmission,
  zuvyPracticeCode,
  zuvyCodingQuestions,
  zuvyFormTracking,
  zuvyModuleForm
} from 'drizzle/schema';
import { throwError } from 'rxjs';
import { ClassesService } from '../classes/classes.service';
import { date } from 'drizzle-orm/mysql-core';
import { BootcampController } from '../bootcamp/bootcamp.controller';


const { ZUVY_CONTENT_URL, ZUVY_CONTENTS_API_URL } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class InstructorService {

}