import { Injectable, Logger } from '@nestjs/common';
import { error, log } from 'console';
import { batchEnrollments, batches, bootcampTracking, bootcamps} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql, } from 'drizzle-orm';

@Injectable()
export class StudentService {
    async enrollData(userId: number) {
    try {
        let enrolled = await db.select().from(batchEnrollments).where(sql`${batchEnrollments.userId} = ${userId} AND ${batchEnrollments.batchId} IS NOT NULL`);
        
        let promises = enrolled.map(async (e) => {
            let bootcamp = await db.select().from(bootcamps).where(eq(bootcamps.id, e.bootcampId));
            let progress = await db.select().from(bootcampTracking).where(sql`${bootcampTracking.userId} = ${userId} AND ${bootcampTracking.bootcampId} = ${e.bootcampId}`);
            bootcamp[0]['progress'] = progress[0] ? progress[0].progress : 0;
           return bootcamp[0];
        });
        
        let totalData = await Promise.all(promises);

        return [null, totalData];
    } catch (err) {
        error(`error: ${err.message}`);
        return [{ 'status': 'error', 'message': err.message, 'code': 500 }, null];
    }
}

}