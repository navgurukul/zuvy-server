import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import { eq,sql, } from 'drizzle-orm';
// import { BatchesService } from '../batches/batch.service';
import axios from 'axios';
import { error, log } from 'console';
import { bootcamps, batches, users, batchEnrollments } from '../../../drizzle/schema';

const {ZUVY_CONTENT_URL} = process.env// INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class BootcampService {
    // constructor(private batchesService:BatchesService) { }
    async enrollData(bootcampId: number) {
        try {
            let enrolled = await db.select().from(batchEnrollments).where(sql`${batchEnrollments.bootcampId} = ${bootcampId}`);
            let unEnrolledBatch = await db.select().from(batchEnrollments).where(sql`${batchEnrollments.bootcampId} = ${bootcampId} AND ${batchEnrollments.batchId} IS NULL`);
            return [null, { 'students_in_bootcamp': enrolled.length, 'unassigned_students': unEnrolledBatch.length }];
        } catch (error) {
            log(`error: ${error.message}`)
            return [{'status': 'error', 'message': error.message,'code': 500}, null];
        }

    }

    async getAllBootcamps(): Promise<any> {
        try {
            let getAllBootcamps = await db.select().from(bootcamps);

            let data = await Promise.all(getAllBootcamps.map(async (bootcamp) => {
                let [err, res] = await this.enrollData(bootcamp.id);
                if (err) {
                    return [err, null];
                }
                return { ...bootcamp, ...res };
            }));
            return [null, data];
        } catch (e) {
            log(`error: ${e.message}`)
            return [{'status': 'error', 'message': e.message,'code': 500}, null];
        }
    }

    async getBootcampById(id: number, isContent: boolean): Promise<any> {
        try {
            let bootcamp = await db.select().from(bootcamps).where(sql`${bootcamps.id} = ${id}`);
            let [err, res] = await this.enrollData(id);

            if (!bootcamp.length){
                return [{'status': 'Error', 'message': 'Bootcamp not found!','code': 404}, null];
            }
            if(isContent){
                try{
                    let respo = await axios.get(ZUVY_CONTENT_URL+`/${id}?populate=zuvy_modules&populate=zuvy_modules.zuvy_articles&populate=zuvy_modules.zuvy_mcqs.quiz.qz`)
                    bootcamp[0]['content'] = respo.data
                } catch (error) {
                    log(`Error posting data: ${error.message}`)
                }
            }

            return [null, {'status': 'success', 'message': 'Bootcamp fetched successfully', 'code': 200, bootcamp: {...bootcamp[0], ...res} }];
        } catch (e) {
            log(`error: ${e.message}`)
            return [{'status': 'error', 'message': e.message,'code': 500}, null];
        }
    }

    async createBootcamp(bootcampData): Promise<any> {
        try{
            let newBootcamp = await db.insert(bootcamps).values(bootcampData).returning();
            try {
            try {  
                const response = await axios.post(ZUVY_CONTENT_URL, {"data":{
                    "id":newBootcamp[0].id,
                    "name": newBootcamp[0].name
                }});
                log(`Created the content in strapi with the name of ${newBootcamp[0].name},`)
            } catch (error) {
                log(`Error posting data: ${error.message}`)
            }
            } catch (error) {
                log(`Error posting data: ${error.message}`)
                return [{'status': 'Error', 'message': error.message,'code': 404}, null];
            }
            log(`Bootcamp created successfully`)
            return [null, {'status': 'success', 'message': 'Bootcamp created successfully','code': 200 , bootcamp: newBootcamp[0]}];

        } catch (e) {
            log(`Error: ${e.message}`)
            return [{'status': 'error', 'message': e.message,'code': 405}, null];
        }
        
    }

    async updateBootcamp(id: number, bootcampData): Promise<any> {
        try {
            delete bootcampData.instructorId;
            let updatedBootcamp = await db.update(bootcamps).set({...bootcampData}).where(eq(bootcamps.id, id)).returning();

            if (updatedBootcamp.length === 0) {
                return [{'status': 'error', 'message': 'Bootcamp not found', 'code': 404}, null];
            }    
            return [null, {'status': 'success', 'message': 'Bootcamp updated successfully','code': 200,updatedBootcamp}];

        } catch (e) {
            log(`error: ${e.message}`)
            return [{'status': 'error', 'message': e.message,'code': 500}, null];
        }
    }

    async deleteBootcamp(id: number): Promise<any> {
        try {
            await db.delete(batches).where(eq(batches.bootcampId, id));
            await db.delete(batchEnrollments).where(eq(batchEnrollments.bootcampId, id));
            let data = await db.delete(bootcamps).where(eq(bootcamps.id, id)).returning();
            if (data.length === 0) {
                return [{'status': 'error', 'message': 'Bootcamp not found', 'code': 404}, null];
            }
            return [null,{'status': 'success', 'message': 'Bootcamp deleted successfully', 'code': 200}];
        } catch (error) {
            log(`error: ${error.message}`)
            return [{'status': 'error', 'message': error.message,'code': 404},null];
        }
    }

    async getBatchByIdBootcamp(bootcamp_id: number): Promise<any>{
        try {
            let res = await db.select().from(batches).where(eq(batches.bootcampId, bootcamp_id));
            return [null, res];
        } catch (e) {
            log(`error: ${e.message}`)
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }
    
    async addStudentToBootcamp(bootcampId: number, batchId: number, users_data: any){
        try {
            console.log('users_data',users_data) 
            console.log('bootcampId',bootcampId)
            console.log('batchId',batchId)

            let enrollments = [];
            let totalEnrolStudents = await db.select().from(batchEnrollments).where(sql`${batchEnrollments.bootcampId} = ${bootcampId}`);
            let bootcampData = await db.select().from(bootcamps).where(sql`${bootcamps.id} = ${bootcampId}`);
            if (bootcampData.length === 0){
                return [{'status': 'error', 'message': 'Bootcamp not found', 'code': 404}, null];
            }
            if (totalEnrolStudents.length >= bootcampData[0].capEnrollment){
                return [{'status': 'error', 'message': 'The maximum capacity for the bootcamp has been reached.', 'code': 403}, null];
            }
            let report = [];
            let userReport = [];
            for (let i = 0; i < users_data.length; i++) {
                let newUser = {}
                newUser["bootcamp_id"] = bootcampId
                newUser["batch_id"] = batchId
                newUser["email"] = users_data[i]["email"] 
                newUser["name"] = users_data[i]["name"]
                
                let userInfo = await db.select().from(users).where(sql`${users.email} = ${users_data[i]["email"]}`);
                if (userInfo.length === 0){
                    userInfo = await db.insert(users).values(newUser).returning();
                } else if(userInfo.length > 0){
                    let userEnrolled = await db.select().from(batchEnrollments).where(sql`${batchEnrollments.userId} = ${ userInfo[0].id.toString()} AND ${batchEnrollments.bootcampId} = ${bootcampId}`);
                    if (userEnrolled.length > 0){
                        report.push({'email': userInfo[0].email, 'message': `already enrolled in anodher bootcamp`});
                        continue;
                    }
                }
                let enroling = {userId:  userInfo[0].id, bootcampId};
                if (batchId){
                    enroling["batchId"] = batchId
                }
                userReport.push({'email': userInfo[0].email, 'message': `enrolled successfully`});
                enrollments.push(enroling);
                }  
            let students_enrolled ;
            if (enrollments.length > 0) {
                students_enrolled = await db.insert(batchEnrollments).values(enrollments).returning();
                if (students_enrolled.length === 0){
                    return [{'status': 'error', 'message': 'Error enrolling students', 'code': 500}, null];
                }
            }

            return [
                null,
                {
                    status: true,
                    code: 200,
                    message: `${enrollments.length} students successfully enrolled!`,
                    report: report,
                    students_enrolled: userReport
                }
            ]
            
        } catch (e) {
            log(`error: ${e.message}`)
            return [{'status': 'error', 'message': e.message,'code': 500},null];
        }
    }

    async getStudentsByBootcampOrBatch(bootcamp_id, batch_id){
        try {
            let queryString ;
            if (bootcamp_id){
                queryString = sql`${batchEnrollments.bootcampId} = ${bootcamp_id}`
            } else if (batch_id){
                queryString = sql`${batchEnrollments.batchId} = ${batch_id}`
            }
            let batchEnrollmentsData = await db.select().from(batchEnrollments).where(queryString);
            return [null, batchEnrollmentsData]
        } catch (e) {
            log(`error: ${e.message}`)
            return [{'status': 'error', 'message': e.message,'code': 500},null];
        }
    }
}