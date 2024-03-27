import { Injectable } from '@nestjs/common';
import { batches, bootcamps, users, sansaarUserRoles, batchEnrollments } from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql } from 'drizzle-orm';
import { log } from 'console';
// import { BootcampService } from '../bootcamp/bootcamp.service';


@Injectable()
export class BatchesService {
    // constructor(private bootcampService:BootcampService) { }

    // async capEnrollment(batch, add_num = 0) {
    //     const bootcamp = await db.select().from(bootcamps).where(eq(bootcamps.id, batch.bootcampId));
    //     if (bootcamp.length === 0) {
    //         return { 'status': 'error', 'message': 'Bootcamp not found', 'code': 404 };
    //     }

    //     const totalBatches = await db.select().from(batches).where(eq(batches.bootcampId, batch.bootcampId));
    //     const capPerBatch = Math.floor(bootcamp[0].capEnrollment / (totalBatches.length + add_num));

    //     if (capPerBatch < 1) {
    //         return { 'status': 'error', 'message': 'Batch capacity cannot be less than 1', 'code': 400 };
    //     }

    //     batch['capEnrollment'] = capPerBatch;

    //     if (totalBatches.length > 0) {
    //         const remainder = bootcamp[0].capEnrollment % (totalBatches.length + 1);
    //         batch['capEnrollment'] += remainder;
    //         await db.update(batches).set({ capEnrollment: capPerBatch }).where(eq(batches.bootcampId, bootcamp[0].id));
    //     }
    //     return batch;
    // }
    // async capEnrollment(batch, flagUpdate = false) {
    //     const bootcamp = await db.select().from(bootcamps).where(eq(bootcamps.id, batch.bootcampId));
    //     if (bootcamp.length === 0) {
    //         return [{ 'status': 'error', 'message': 'Bootcamp not found', 'code': 404 }, null];
    //     }
    //     let totalBatches = await db.select().from(batches).where(eq(batches.bootcampId, batch.bootcampId));
    //     if (flagUpdate) {
    //         totalBatches = totalBatches.filter(b => b.id !== batch.id);
    //     }
    //     // let totalEnrolment = totalBatches.reduce((acc, b) => acc + b.capEnrollment, 0);
    //     // if (totalEnrolment + batch.capEnrollment > bootcamp[0].capEnrollment) {
    //     //     return [{ 'status': 'error', 'message': 'The maximum capacity for the bootcamp has been reached', 'code': 400 }, null];
    //     // }
    //     return [null, true];
    // }

    async createBatch(batch) {
        try {
            // // let [err,res] =  await this.capEnrollment(batch);
            // if(err){
            //     return [err, null];
            // }

            const newData = await db.insert(batches).values(batch).returning();
            const usersData = await db.select().from(batchEnrollments).where(sql`${batchEnrollments.bootcampId} = ${batch.bootcampId} AND ${batchEnrollments.batchId} IS NULL`).limit(batch.capEnrollment);

            if (usersData.length > 0) {
                let userids = usersData.map(u => u.userId);
                await db.update(batchEnrollments).set({ batchId: newData[0].id }).where(sql`user_id IN ${userids}`);
            }
            return [null, { 'status': 'success', 'message': 'Batch created successfully', 'code': 200, batch: newData[0] }];
        } catch (e) {
            log(`error: ${e.message}`)
            return [{ 'status': 'error', 'message': e.message, 'code': 500 }, null];
        }
    }

    async getBatchById(id: number) {
        try {
            let data = await db.select().from(batches).where(eq(batches.id, id));
            if (data.length === 0) {
                return [{ status: 'error', message: 'Batch not found', code: 404 }, null];
            }
            let respObj = [];
            // if (students){
            let enrollStudents = await db.select().from(batchEnrollments).where(eq(batchEnrollments.batchId, id));
            
            // let enrollStudentsId;
            // if (enrollStudents.length !== 0) {
            //     enrollStudentsId = enrollStudents.map(e => BigInt(e.userId)); // Convert e.userId to bigint
            //     console.log("students",enrollStudentsId);
            //     let students = await db.select().from(users).where(sql`id IN ${enrollStudentsId}`);
              
            //     enrollStudents.map((e) => {
            //         students.find((s) => {
            //             if (s.id === BigInt(e.userId)) {
            //                 respObj.push({ 'id': e.userId, "email": s.email, "name": s.name });
            //             }
            //         });
            //     });

            // }
             const batchInstructor = await db
               .select()
               .from(users)
               .where(eq(users.id, BigInt(data[0].instructorId)));
             const instructorName =
               batchInstructor.length > 0 ? batchInstructor[0].name : null;
             data[0]['instructorName'] = instructorName;
           // data[0]['students'] = respObj;
            return [null, { status: 'success', message: 'Batch fetched successfully', code: 200, batch: data[0] }];
            // }
            // return [null, {status: 'success', message: 'Batch fetched successfully', code: 200, batch: data[0]}];
        } catch (e) {
            log(`error: ${e.message}`)
            return [{ 'status': 'error', 'message': e.message, 'code': 500 }, null];
        }
    }

    async updateBatch(id: number, batch: object) {
        try {
            let batchData = await db.select().from(batches).where(eq(batches.id, id));
            if (batchData.length === 0) {
                return [{ status: 'error', message: 'Batch not found', code: 404 }, null];
            }
            // if (batch['capEnrollment']) {
            //     batchData[0].capEnrollment =batch['capEnrollment']
            //     // let [err,res] =  await this.capEnrollment(batchData[0], true);
            //     // if(err){
            //     //     return [err, null];
            //     // }
            // }
            batch['updatedAt'] = new Date();
            let updateData = await db.update(batches).set(batch).where(eq(batches.id, id)).returning()
            if (updateData.length === 0) {
                return [{ status: 'error', message: 'Batch not found', code: 404 }, null];
            }
            return [null, { status: 'success', message: 'Batch updated successfully', code: 200, batch: updateData[0] }];
        } catch (e) {
            log(`error: ${e.message}`)
            return [{ 'status': 'error', 'message': e.message, 'code': 500 }, null];
        }
    }

    async deleteBatch(id: number) {
        try {
            let data = await db.delete(batches).where(eq(batches.id, id)).returning();
            await db.update(batchEnrollments).set({ "batchId": null }).where(eq(batchEnrollments.batchId, id)).returning()
            if (data.length === 0) {
                return [{ status: 'error', message: 'Batch not found', code: 404 }, null];
            }
            return [null, { status: 'success', message: 'Batch deleted successfully', code: 200 }];
        } catch (e) {
            log(`error: ${e.message}`)
            return [{ 'status': 'error', 'message': e.message, 'code': 500 }, null];
        }
    }
}