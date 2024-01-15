import { Injectable } from '@nestjs/common';
import { bootcamps,batches } from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq,sql, } from 'drizzle-orm';
import {BatchesService } from '../batches/batch.service'
@Injectable()
export class BootcampService {
    constructor(private batchesService: BatchesService) {}
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
            return bootcamp[0];
        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async createBootcamp(bootcampData): Promise<object> {
        try{
            let instractorId = bootcampData.instractorId
            delete bootcampData.instractorId;
            bootcampData["createdAt"] = new Date();
            bootcampData["updatedAt"] = new Date();
            console.log('bootcampData: ',bootcampData);

            let newBootcamp = await db.insert(bootcamps).values(bootcampData).returning();

            return {'status': 'success', 'message': 'Bootcamp created successfully','code': 200 , bootcamp: newBootcamp[0]};

        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 405};
        }
        
    }

    async updateBootcamp(id: number, bootcampData): Promise<object> {

        try {
            bootcampData['updatedAt'] = new Date();
            console.log('id',id)
            console.log('data',bootcampData)
            let instractorId = bootcampData.instractorId
            delete bootcampData.instractorId;

            let updatedBootcamp = await db.update(bootcamps).set({...bootcampData}).where(eq(bootcamps.id, id)).returning();
            let update_data = {"bootcamp":updatedBootcamp[0]}
            let batch_data = await db.select().from(batches).where(eq(batches.bootcampId, id));
            console.log('batch: ', batch_data)
            if (batch_data.length == 0){
                delete bootcampData.coverImage;
                delete bootcampData.bootcampTopic;
                delete bootcampData.schedules;
                delete bootcampData.language;
            
                bootcampData.createdAt = new Date();
                bootcampData.updatedAt = new Date();
                console.log('newBootcamp: ',updatedBootcamp);
                bootcampData["instractorId"] = instractorId;
                bootcampData.name = "Batch 1";
                bootcampData["bootcampId"] = id;
                console.log('bootcampData: ',bootcampData)
                let newBatch = await db.insert(batches).values(bootcampData).returning();
                update_data["batch"] = newBatch[0]
            }
            return {'status': 'success', 'message': 'Bootcamp updated successfully','code': 200,update_data}

        } catch (e) {
            console.log('e: ',e)
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async deleteBootcamp(id: number): Promise<object> {
        try {
            await db.delete(bootcamps).where(eq(bootcamps.id, id));
            return {'status': 'success', 'message': 'Bootcamp deleted successfully', 'code': 200};
        } catch (error) {
            return {'status': 'error', 'message': error.message,'code': 404};
        }
    }
}
