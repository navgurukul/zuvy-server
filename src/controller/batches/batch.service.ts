import { Injectable } from '@nestjs/common';
import {batches, users , sansaarUserRoles} from '../../../drizzle/schema';
import { db} from '../../db/index';
import { eq } from 'drizzle-orm';
import { BatchesModule } from './batch.module';


@Injectable()
export class BatchesService {
    async createBatch(batch){
        try{
            batch['created_at'] = new Date();
            batch['updated_at'] = new Date();
            console.log('batch: ',batch);
            let newData = await db.insert(batches).values(batch).returning();
            return {'status': 'success', 'message': 'Batch created successfully','code': 200, batch: newData[0]};
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
}