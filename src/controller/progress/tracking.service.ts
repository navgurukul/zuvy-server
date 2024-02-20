import { Injectable, Logger } from '@nestjs/common';
import { assignmentSubmission, articleTracking, moduleTracking, bootcampTracking,  quizTracking,batches, bootcamps} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql, inArray, and, desc } from 'drizzle-orm';
import axios from 'axios';
import { error, log } from 'console';

const {ZUVY_CONTENT_URL, ZUVY_CONTENTS_API_URL} = process.env// INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class TrackingService {
    async getProgress(user_id: number, module_id: number, bootcampId: number) {
        try{
            let response;
            try{
                response = await axios.get(`${ZUVY_CONTENTS_API_URL}/zuvy-modules/${module_id}?populate=zuvy_articles&populate=zuvy_mcqs.quiz.qz`);
            } catch (e){
                return [{ status: 'error', message: e.message, code: 402 }];
            }

            let zuvy_articles = response.data.data.attributes.zuvy_articles
            
            let zuvy_mcqs_ids = []
            response.data.data.attributes.zuvy_mcqs.data.map((zuvy_mcqs)=> {
                let mcqs_ids = zuvy_mcqs.attributes.quiz.map(mcq => mcq.id);
                zuvy_mcqs_ids.push(...mcqs_ids)
            })
            let zuvy_assignment_ids = []
            let zuvy_articles_ids =  []

            zuvy_articles.data.map((data)=>{
                if (data.attributes.label == 'article') {
                    zuvy_articles_ids.push(data.id);
                    return;
                } else if (data.attributes.label == 'assignment') {
                    zuvy_assignment_ids.push(data.id);
                    return;
                }
            });

            let a = []
            let b = []
            let c = []
            if (zuvy_articles_ids.length){
                a = await db.select().from(articleTracking).where( and(inArray(articleTracking.articleId, zuvy_articles_ids), sql`${articleTracking.userId} = ${user_id}`))//.where(sql`${articleTracking.userId} = ${user_id}`);
            }
            if (zuvy_mcqs_ids.length){
                b = await db.select().from(quizTracking).where(and(inArray(quizTracking.mcqId, zuvy_mcqs_ids), sql`${quizTracking.userId} = ${user_id}`));
            }
            if (zuvy_assignment_ids.length){
                c = await db.select().from(assignmentSubmission).where(and(inArray(assignmentSubmission.assignmentId, zuvy_assignment_ids), sql`${assignmentSubmission.userId} = ${user_id}`));
            }

            let total_score = a.length + b.length + c.length;
            let total = zuvy_articles_ids.length + zuvy_mcqs_ids.length + zuvy_assignment_ids.length;
            let progress =  Math.floor((total_score/total)*100);
            
            let getmoduleTracking = await db.select().from(moduleTracking).where(sql`${moduleTracking.userId} = ${user_id} and ${moduleTracking.moduleId} = ${module_id}`);
            if (getmoduleTracking.length == 0) {
                let insertmoduleTracking = await db.insert(moduleTracking).values({userId: user_id, moduleId: module_id, progress, bootcampId}).returning();
                
                log(`insert the progress of the user_id:${user_id}, ${progress}`)
            } else {
                let updatemoduleTracking = await db.update(moduleTracking).set({progress: progress}).where(sql`${moduleTracking.userId} = ${user_id} and ${moduleTracking.moduleId} = ${module_id}`).returning();
                log(`update the progress of the user_id:${user_id}, ${progress}`)
            }
            await this.updateBootcampProgress( user_id, bootcampId);
            
            return [null, {progress}]
        } catch (e){
            error(`ERROR: ${e.massage}  user_id:${user_id}`)
            return [{ status: 'error', message: e.message, code: 402 }];
        }
    }

    async updateBootcampProgress ( user_id: number, bootcamp_id: number){
        try{
            let getModules;
            try {
                getModules = await axios.get(`${ZUVY_CONTENT_URL}/${bootcamp_id}?populate=zuvy_modules`);
            } catch (e){
                return [{ status: 'error', message: e.message, code: 402 }];
            }
            let modules = getModules.data.data.attributes.zuvy_modules.data;

            let getProgressByBootcampModule = await db.select().from(moduleTracking).where(sql`${moduleTracking.userId} = ${user_id} and ${moduleTracking.bootcampId} = ${bootcamp_id}`);
            
            let get_users_bootcamp = await db.select().from(bootcampTracking).where(sql`${bootcampTracking.userId} = ${user_id} and ${bootcampTracking.bootcampId} = ${bootcamp_id}`);
  
            let bootcamp_progress = 0;
    
            getProgressByBootcampModule.map((module) => {
                bootcamp_progress += module.progress;
            })
    
            bootcamp_progress = Math.floor((bootcamp_progress/(modules.length*100))*100);
            if (get_users_bootcamp.length == 0) {
                let insertBootcampProgress = await db.insert(bootcampTracking).values({userId: user_id, bootcampId:bootcamp_id, progress:bootcamp_progress}).returning();
                
                if (insertBootcampProgress.length){
                    log(`insert the progress of the user_id:${user_id}, ${bootcamp_progress}`)
                    return [null, {status: 'success', message: 'Progress insert'}];
                }
            } else {
                let updateBatch = await db.update(bootcampTracking).set({progress:bootcamp_progress}).where(sql`${bootcampTracking.userId} = ${user_id} and ${bootcampTracking.bootcampId} = ${bootcamp_id}`).returning();
                if (updateBatch.length){
                    log(`update the progress of the user_id:${user_id}, ${bootcamp_progress}`)
                    return [null, {status: 'success', message: 'Progress update'}]
                }
            }
        } catch (e){
            return [{ status: 'error', message: e.message, code: 402 }];
        }
    }

    // Create
    async submissionAssignment(data: any, bootcampId: number) {
        try {
            const res = await db.select().from(assignmentSubmission).where(sql`${assignmentSubmission.userId} = ${data.userId} and ${assignmentSubmission.assignmentId} = ${data.assignmentId}`);

            if (res.length == 0) {
                const result = await db.insert(assignmentSubmission).values(data).returning();
                let [err,res] =await this.getProgress(data.userId, data.moduleId, bootcampId);
                if (err){
                    return [null, {status: 'error', message: "progrss haven't update!",data:result[0], code: 203}];
                }
                return [null, result[0]];
            }
            return [{ status: 'error', message: 'Assignment already submitted', code: 402 }];
        } catch (err) {
            return [{ status: 'error', message: err.message, code: 402 }];
        }
    }

    async assignmentSubmissionBy(userId: number, assignmentId: number) {
        try {
            const result = await db.select().from(assignmentSubmission).where(sql`${assignmentSubmission.userId} = ${userId} and ${assignmentSubmission.assignmentId} = ${assignmentId}`);
            return [null, result];
        } catch (err) {
            return [{ status: 'error', message: err.message, code: 402 }];
        }
    }

    // Read
    async getAssignmentSubmission(userId: number) {
        try {
            const result = await db.select().from(assignmentSubmission).where(sql`${assignmentSubmission.userId} = ${userId}`);
            return [null, result];
        } catch (err) {
            return [{ status: 'error', message: err.message, code: 402 }];
        }
    }

    // Update
    async updateAssignmentSubmission(id: number, data: any) {
        try {
            const result = await db.update(assignmentSubmission).set(data).where(sql`${assignmentSubmission.id} = ${id}`).returning();
            return [null, result];
        } catch (err) {
            return [{ status: 'error', message: err.message, code: 402 }];
        }
    }

    // Create
    async createArticleTracking(data: any, bootcampId: number) {
        try {
            const artical = await db.select().from(articleTracking).where(sql`${articleTracking.articleId} = ${data.articleId} and ${articleTracking.userId} = ${data.userId}`);
            if (artical.length == 0){
                const result = await db.insert(articleTracking).values(data).returning();
                let [err, out] = await this.getProgress(data.userId, data.moduleId, bootcampId);
                if (err){
                    return [null, {status: 'error', message: "progrss haven't update!",data:result[0], code: 203}];
                }
                return [null, result[0]];
            }
            return [{ status: 'error', message: 'Article already tracked', code: 402 }];
        } catch (err) {
            return [{ status: 'error', message: err.message, code: 402 }];
        }
    }

    // Read
    async articleTrackingBy(ArticleId: number, userId: number) {
        try {
            const result = await db.select().from(articleTracking).where(sql`${articleTracking.articleId} = ${ArticleId} and ${articleTracking.userId} = ${userId}`);

            return [null, result];
        } catch (err) {
            return [{ status: 'error', message: err.message, code: 402 }];
        }
    }

    // Read
    async getArticleTracking(userId: number) {
        try {
            const result = await db.select().from(articleTracking).where(sql`${articleTracking.userId} = ${userId}`);
            return [null, result];
        } catch (err) {
            return [{ status: 'error', message: err.message, code: 402 }];
        }
    }

    // Update
    async updateArticleTracking(id: number, data: any) {
        try {
            const result = await db.update(articleTracking).set(data).where(sql`${articleTracking.id} = ${id}`);
            return [null, result];
        } catch (err) {
            return [{ status: 'error', message: err.message, code: 402 }];
        }
    }

    // Create
    async createQuizTracking(data: any, bootcampId: number) {
        try {
            const result = await db.insert(quizTracking).values(data).returning();
            await Promise.all(data.map(d => this.getProgress(d.userId, d.moduleId, bootcampId)));
            return [null, result];
            
        } catch (err) {
            return [{ status: 'error', message: err.message, code: 402 }];
        }
    }

    // Read
    async getQuizTracking(userId: number) {
        try {
            const result = await db.select().from(quizTracking).where(sql`${quizTracking.userId} = ${userId}`);
            return [null, result];
        } catch (err) {
            return [{ status: 'error', message: err.message, code: 402 }];
        }
    }

    // Update
    async updateQuizTracking(id: number, data: any) {
        try {
            const result = await db.update(quizTracking).set(data).where(sql`${quizTracking.id} = ${id}`).returning();
            return [null, result];
        } catch (err) {
            return [{ status: 'error', message: err.message, code: 402 }];
        }
    }

    // Read
    async quizTrackBy(quizId: number, userId: number) {
        try {
            const result = await db.select().from(quizTracking).where(sql`${quizTracking.quizId} = ${quizId} and ${quizTracking.userId} = ${userId}`);
            return [null, result];
        } catch (err) {
            return [{ status: 'error', message: err.message, code: 402 }];
        }
    }
    // get the latest artical, mcq and assignment ids, with the module id with bootcamp id
    async getLatestIds(userId: number) {
        try {
            const latestIds = await db.select()
                .from(articleTracking)
                .where(sql`${articleTracking.userId} = ${userId}`)
                .orderBy(desc(articleTracking.id))// Fix: Call the desc() method on the column object
                .limit(1);

            const latestMcqIds = await db.select()
                .from(quizTracking)
                .where(sql`${quizTracking.userId} = ${userId}`)
                .orderBy(desc(quizTracking.id))// Fix: Call the desc() method on the column object
                .limit(1)

            const latestAssignmentIds = await db.select()
                .from(assignmentSubmission)
                .where(sql`${assignmentSubmission.userId} = ${userId}`)
                .orderBy(desc(assignmentSubmission.id))// Fix: Call the desc() method on the column object
                .limit(1);
            let totaldata = [latestIds[0], latestMcqIds[0], latestAssignmentIds[0]];

            totaldata.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            if (totaldata.length != 0) {
                let contents =  await axios.get(`${ZUVY_CONTENTS_API_URL}/zuvy-modules/${totaldata[0].moduleId}?populate=zuvy_contents`);
                
                totaldata[0]["bootcampId"] = contents.data.data.attributes.zuvy_contents.data[0].id
            }
            return [null, totaldata[0]];
        } catch (e){
            return [{ status: 'error', message: e.message, code: 402 }];
        }
    }
}