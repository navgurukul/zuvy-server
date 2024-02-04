import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq,sql, } from 'drizzle-orm';
import { BatchesService } from '../batches/batch.service';
import axios from 'axios';
import { log } from 'console';
import { bootcamps, batches, users, batchEnrollments } from '../../../drizzle/schema';

const {ZUVY_CONTENT_URL} = process.env// INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class BootcampService {
    constructor(private batchesService:BatchesService) { }
    async getAllBootcamps(): Promise<object> {
        try {
            const allUsers = await db.select().from(bootcamps);
            return allUsers
        } catch (e) {
            log(`error: ${e.message}`)
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async getBootcampById(id: number, isContent: boolean): Promise<object> {
        try {
            let bootcamp = await db.select().from(bootcamps).where(sql`${bootcamps.id} = ${id}`);
            if (!bootcamp.length){
                return {'status': 'Error', 'message': 'Bootcamp not found!','code': 404}
            }
            if(isContent){
                let respo = await axios.get(ZUVY_CONTENT_URL+`/${id}?populate=zuvy_modules&populate=zuvy_modules.zuvy_articles&populate=zuvy_modules.zuvy_mcqs.quiz.qz`)
                bootcamp[0]['content'] = respo.data
            }
            return {'status': 'success', 'message': 'Bootcamp fetched successfully', 'code': 200, bootcamp: bootcamp[0]};
        } catch (e) {
            log(`error: ${e.message}`)
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async createBootcamp(bootcampData): Promise<object> {
        try{

            bootcampData["createdAt"] = new Date();
            bootcampData["updatedAt"] = new Date();
            let newBootcamp = await db.insert(bootcamps).values(bootcampData).returning();

            try {
            const response = await axios.post(ZUVY_CONTENT_URL, {
                "data":{
                    "id":newBootcamp[0].id,
                    "name": newBootcamp[0].name
                }
            });
            log(`Created the content in strapi with the name of ${newBootcamp[0].name},`)
            } catch (error) {
                log(`Error posting data: ${error.message}`)
                throw new Error(`Error posting data: ${error.message}`);
            }
            log(`Bootcamp created successfully`)
            return {'status': 'success', 'message': 'Bootcamp created successfully','code': 200 , bootcamp: newBootcamp[0]};

        } catch (e) {
            log(`Error: ${e.message}`)
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
                const response = await axios.put(ZUVY_CONTENT_URL+`/${id}`, {
                    "data":{
                        "name": bootcampData.name
                    }
                });
                log('Update the name of the content in strapi')
            }
            if (bootcampData && bootcampData.capEnrollment){
                await this.batchesService.capEnrollment({bootcampId : id})
            }
            return {'status': 'success', 'message': 'Bootcamp updated successfully','code': 200,update_data}

        } catch (e) {
            log(`error: ${e.message}`)
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
            log(`error: ${error.message}`)
            return {'status': 'error', 'message': error.message,'code': 404};
        }
    }

    async getBatchByIdBootcamp(bootcamp_id: number){
        try {
            return await db.select().from(batches).where(eq(batches.bootcampId, bootcamp_id));
        } catch (e) {
            log(`error: ${e.message}`)
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }
    async addStudentToBootcamp(bootcampId: number, batchId: number, users_data: any){
        try {
            let enrollments = [];
            for (let i = 0; i < users_data.length; i++) {
                let newUser = {}
                newUser["bootcamp_id"] = bootcampId
                newUser["batch_id"] = batchId
                newUser["student_email"] = users_data[i]["email"] 
                let userInfo = await db.select().from(users).where(sql`${users.email} = ${users_data[i]["email"]}`);

                if (userInfo.length === 0){
                    newUser["createdAt"] = new Date();
                    newUser["updatedAt"] = new Date();
                    userInfo = await db.insert(users).values(newUser).returning();
                } 
                let enroling = {userId:  userInfo[0].id,
                    bootcampId};
                if (batchId){
                    enroling["batchId"] = batchId
                }
                enrollments.push(enroling);
                }  
            if (enrollments.length > 0) {
              await db.insert(batchEnrollments).values(enrollments);
            }
            return {'status': 'success', 'message': 'Studentes enrolled successfully', 'code': 200};
        } catch (e) {
            log(`error: ${e.message}`)
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }
}