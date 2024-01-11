import { Injectable } from '@nestjs/common';
import {batches, bootcamps,users , sansaarUserRoles} from '../../../drizzle/schema';
import { db} from '../../db/index';
import { eq } from 'drizzle-orm';
// import { BatchesModule } from './batch.module';


@Injectable()
export class BatchesService {
    async createBatch(batch){
        try{
            let bootcamp = await db.select().from(bootcamps).where(eq(bootcamps.id, batch.bootcamp_id));
            let batchData = await db.select().from(batches).where(eq(batches.bootcamp_id, batch.bootcamp_id));

            batch['created_at'] = new Date();
            batch['updated_at'] = new Date();
            if (batchData.length > 0) {
                let totalBatches = batchData.length + 1;
                let capPerBatch = Math.floor(bootcamp[0].cap_enrollment / totalBatches);
                if (capPerBatch < 1){
                    return {'status': 'error', 'message': 'Batch capacity cannot be less than 1','code': 400};
                } 
                batch['cap_enrollment'] = capPerBatch;
                let remainder = bootcamp[0].cap_enrollment % totalBatches;
                await db.update(batches).set({cap_enrollment: batch.cap_enrollment}).where(eq(batches.bootcamp_id, bootcamp[0].id)).returning();

                batch['cap_enrollment'] = capPerBatch + remainder;
                let newData = await db.insert(batches).values(batch).returning();
                return {'status': 'success', 'message': 'Batch created successfully','code': 200, batch: newData[0]};
            } else {
                batch['cap_enrollment'] = bootcamp[0].cap_enrollment;
                let newData = await db.insert(batches).values(batch).returning();
                return {'status': 'success', 'message': 'Batch created successfully','code': 200, batch: newData[0]};
            }
        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async getBatchById(id: number) {
        try {
            return (await db.select().from(batches).where(eq(batches.id, id)));
        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async getAllBatches(){
        try {
            return await db.select().from(batches);
        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async updateBatch(id: number, batch: object) {
        try {
            batch['updated_at'] = new Date();
            return await db.update(batches).set(batch).where(eq(batches.id, id)).returning()
        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async deleteBatch(id: number) {
        try {
            await db.delete(batches).where(eq(batches.id, id));
            return {status: 'success', message: 'Batch deleted successfully', code: 200};
        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async getBatchByIdBootcamp(bootcamp_id: number){
        try {
            console.log('bootcamp_id: ',bootcamp_id);
            return await db.select().from(batches).where(eq(batches.bootcamp_id, bootcamp_id));
        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }
}