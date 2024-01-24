import { Injectable } from '@nestjs/common';
import { bootcamps,batches } from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq,sql, } from 'drizzle-orm';
import { BatchesService } from '../batches/batch.service';

@Injectable()
export class BootcampService {
    constructor(private batchesService:BatchesService) { }
    async getAllBootcamps(): Promise<object> {
        try {
            const allUsers = await db.select().from(bootcamps);
            return allUsers
        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async getBootcampById(id: number): Promise<object> {
        try {
            const bootcamp = await db.select().from(bootcamps).where(sql`${bootcamps.id} = ${id}`);
            return {'status': 'success', 'message': 'Bootcamp fetched successfully', 'code': 200, bootcamp: bootcamp[0]};
        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async createBootcamp(bootcampData): Promise<object> {
        try{
            bootcampData["createdAt"] = new Date();
            bootcampData["updatedAt"] = new Date();

            let newBootcamp = await db.insert(bootcamps).values(bootcampData).returning();

            return {'status': 'success', 'message': 'Bootcamp created successfully','code': 200 , bootcamp: newBootcamp[0]};

        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 405};
        }
        
    }

    async updateBootcamp(id: number, bootcampData): Promise<object> {
        try {
            let instructorId = bootcampData.instructorId
            delete bootcampData.instructorId;
            let updatedBootcamp = await db.update(bootcamps).set({...bootcampData}).where(eq(bootcamps.id, id)).returning();

            if (updatedBootcamp.length === 0) {
                return {'status': 'error', 'message': 'Bootcamp not found', 'code': 404};
            }

            let update_data = {"bootcamp":updatedBootcamp[0]}
            let batch_data = await db.select().from(batches).where(eq(batches.bootcampId, id));
            if (batch_data.length == 0){
                let batchData = {instructorId, name: "batch 1", capEnrollment: bootcampData.capEnrollment, bootcampId: id}
                let newBatch = await db.insert(batches).values(batchData).returning();
                update_data["batch"] = newBatch[0]
            }
            await this.batchesService.capEnrollment({bootcampId : id})
            return {'status': 'success', 'message': 'Bootcamp updated successfully','code': 200,update_data}

        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async deleteBootcamp(id: number): Promise<object> {
        try {
            await db.delete(batches).where(eq(batches.bootcampId, id));
            let data = await db.delete(bootcamps).where(eq(bootcamps.id, id)).returning();

            if (data.length === 0) {
                return {'status': 'error', 'message': 'Bootcamp not found', 'code': 404};
            }
            return {'status': 'success', 'message': 'Bootcamp deleted successfully', 'code': 200};
        } catch (error) {
            return {'status': 'error', 'message': error.message,'code': 404};
        }
    }

    async getBatchByIdBootcamp(bootcamp_id: number){
        try {
            return await db.select().from(batches).where(eq(batches.bootcampId, bootcamp_id));
        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async updatePartialBootcamp(id: number, partialData): Promise<object> {
        try {
            partialData["updatedAt"] = new Date();
            console.log(partialData)
            console.log(id)
            console.log(typeof id,'<<<<<<<<<')
            let updatedBootcamp = await db.update(bootcamps).set({...partialData}).where(eq(bootcamps.id, id)).returning();
            
            if (updatedBootcamp.length === 0) {
                return {'status': 'error', 'message': 'Bootcamp not found', 'code': 404};
            }

            return {'status': 'success', 'message': 'Bootcamp partially updated successfully','code': 200, bootcamp: updatedBootcamp[0]};

        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }
}