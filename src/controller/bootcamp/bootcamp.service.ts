import { Injectable } from '@nestjs/common';
import { bootcamps,batches, users , sansaarUserRoles} from '../../../drizzle/schema';
import { db} from '../../db/index';
import { eq,sql, } from 'drizzle-orm';

@Injectable()
export class BootcampService {
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
            let instractor_id = bootcampData.instractor_id
            delete bootcampData.instractor_id;
            bootcampData["created_at"] = new Date();
            bootcampData["updated_at"] = new Date();
            console.log('bootcampData: ',bootcampData);

            let newBootcamp = await db.insert(bootcamps).values(bootcampData).returning();

            delete bootcampData.cover_image;
            delete bootcampData.bootcamp_topic;
            delete bootcampData.schedules;
            delete bootcampData.language;
    
    
            bootcampData.createdAt = new Date();
            bootcampData.updatedAt = new Date();
            let batchData = {};
            console.log('newBootcamp: ',newBootcamp);
            bootcampData["instractor_id"] = instractor_id;
            bootcampData.name = "Batch 1";
            bootcampData["bootcamp_id"] = newBootcamp[0].id;
    
            let newBatch = await db.insert(batches).values(bootcampData).returning();

            return {'status': 'success', 'message': 'Bootcamp created successfully','code': 200 , bootcamp: newBootcamp[0], batch: newBatch[0]};

        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 405};
        }
        
    }

    async updateBootcamp(id: number, bootcampData: object): Promise<object> {
        try {
            bootcampData['updatedAt'] = new Date();
            return await db.update(bootcamps).set(bootcampData).where(eq(bootcamps.id, id)).returning();
        } catch (e) {
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
