import { Injectable, Logger,HttpStatus, BadRequestException  } from '@nestjs/common';
import { db } from '../../db/index';
import { eq, sql, count, inArray, or, and, like,desc } from 'drizzle-orm';
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
  userBatchRelations,
} from '../../../drizzle/schema';
import { batch } from 'googleapis/build/src/apis/batch';

const { ZUVY_CONTENT_URL } = process.env; // INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class AdminAccessService {
  private readonly logger = new Logger(AdminAccessService.name);
  async getUsersWithBatches() {
    try {
      
      const usersWithBatches = await db.query.users.findMany({
        with: {
          batchEnrollments: true,
        },
      });

      return usersWithBatches;
    } catch (error) {
      this.logger.error('Failed to fetch users with batches', error);
      throw new BadRequestException('Failed to fetch users with batches');
    }
  }
  
}