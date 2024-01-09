import { Injectable } from '@nestjs/common';
import { Bootcamps, users , sansaarUserRoles} from '../../../drizzle/schema';
import { db} from '../../db/index';
import { eq,sql, } from 'drizzle-orm';

@Injectable()
export class BootcampService {
    async getAllBootcamps(): Promise<object> {
        const allUsers = await db.select().from(Bootcamps);
        return allUsers
    }

    async getBootcampById(id: number): Promise<object> {
        const bootcamp = await db.select().from(Bootcamps).where(sql`${Bootcamps.id} = ${id}`);
        return bootcamp[0];
    }

    async createBootcamp(bootcampData): Promise<object> {
        let instractor_email = bootcampData.instractor_email;
        let instractor = await db.select().from(users).where(sql`${users.email} = ${instractor_email}`);
        if (instractor.length == 0) {
            await db.insert(users).values({email: bootcampData.instractor_email});
            instractor = await db.select().from(users).where(sql`${users.email} = ${instractor_email}`);
        }
        bootcampData.instractor_id = instractor[0].id;
        const instractor_role = await db.select().from(sansaarUserRoles).where(sql`${sansaarUserRoles.id} = ${bootcampData.instractor_id} AND ${sansaarUserRoles.role} = 'instractor'`);
        if (instractor_role.length == 0) {
            let instractor_role = {userId: parseInt(bootcampData.instractor_id), role: 'instractor', createdAt: new Date().toISOString()}
            await db.insert(sansaarUserRoles).values(instractor_role);
        }

        delete bootcampData.instractor_email;
        bootcampData.createdAt = new Date();
        bootcampData.updatedAt = new Date();
        await db.insert(Bootcamps).values(bootcampData);
        return {'status': 'success', 'message': 'Bootcamp created successfully','code': 200};
    }

    async updateBootcamp(id: number, bootcampData: object): Promise<object> {
        bootcampData['updatedAt'] = new Date();
        await db.update(Bootcamps).set(bootcampData).where(eq(Bootcamps.id, id));
        return {'status': 'success', 'message': 'Bootcamp updated successfully','code': 200};
    }

    async deleteBootcamp(id: number): Promise<object> {
        try {
            await db.delete(Bootcamps).where(eq(Bootcamps.id, id));
            return {'status': 'success', 'message': 'Bootcamp deleted successfully', 'code': 200};
        } catch (error) {
            return {'status': 'error', 'message': error.message,'code': 404};
        }
    }
}
