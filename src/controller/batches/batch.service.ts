import { Injectable } from '@nestjs/common';
import {batches, bootcamps,users , sansaarUserRoles} from '../../../drizzle/schema';
import { db} from '../../db/index';
import { eq } from 'drizzle-orm';
// import { BatchesModule } from './batch.module';


@Injectable()
export class BatchesService {
    
    async capEnrollment(batch, add_num = 0) {
        const bootcamp = await db.select().from(bootcamps).where(eq(bootcamps.id, batch.bootcampId));
        if (bootcamp.length === 0) {
            return { 'status': 'error', 'message': 'Bootcamp not found', 'code': 404 };
        }

        const totalBatches = await db.select().from(batches).where(eq(batches.bootcampId, batch.bootcampId));
        const capPerBatch = Math.floor(bootcamp[0].capEnrollment / (totalBatches.length + add_num));

        if (capPerBatch < 1) {
            return { 'status': 'error', 'message': 'Batch capacity cannot be less than 1', 'code': 400 };
        }

        batch['capEnrollment'] = capPerBatch;

        if (totalBatches.length > 0) {
            const remainder = bootcamp[0].capEnrollment % (totalBatches.length + 1);
            batch['capEnrollment'] += remainder;
            await db.update(batches).set({ capEnrollment: capPerBatch }).where(eq(batches.bootcampId, bootcamp[0].id));
        }
        return batch;
    }

    async createBatch(batch) {
        try {
            let batchData = await this.capEnrollment(batch, 1);
            const newData = await db.insert(batches).values(batchData).returning();
            return { 'status': 'success', 'message': 'Batch created successfully', 'code': 200, batch: newData[0] };
        } catch (e) {
            return { 'status': 'error', 'message': e.message, 'code': 500 };
        }
    }

    async getBatchById(id: number) {
        try {
            let data = await db.select().from(batches).where(eq(batches.id, id));
            if (data.length === 0) {
                return {status: 'error', message: 'Batch not found', code: 404};
            }
            return {status: 'success', message: 'Batch fetched successfully', code: 200, batch: data[0]};
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
            batch['updatedAt'] = new Date();
            let updateData = await db.update(batches).set(batch).where(eq(batches.id, id)).returning()
            if (updateData.length === 0) {
                return {status: 'error', message: 'Batch not found', code: 404};
            }
            return {status: 'success', message: 'Batch updated successfully', code: 200, batch: updateData[0]};
        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async deleteBatch(id: number) {
        try {
            let data = await db.delete(batches).where(eq(batches.id, id)).returning();
            if (data.length === 0) {
                return {status: 'error', message: 'Batch not found', code: 404};
            }
            await this.capEnrollment({bootcampId:data[0]?.bootcampId});
            return {status: 'success', message: 'Batch deleted successfully', code: 200};
        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }
    async updatePartialBatch(id: number, partialBatch) {
        try {
            partialBatch['updatedAt'] = new Date();
            let updateData = await db.update(batches).set(partialBatch).where(eq(batches.id, id)).returning();
            if (updateData.length === 0) {
                return { status: 'error', message: 'Batch not found', code: 404 };
            }
            return { status: 'success', message: 'Batch updated successfully', code: 200, batch: updateData[0] };
        } catch (e) {
            return { 'status': 'error', 'message': e.message, 'code': 500 };
        }
    }

    
}