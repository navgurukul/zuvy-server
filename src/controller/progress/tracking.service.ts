import { Injectable, Logger } from '@nestjs/common';
import { assignmentSubmission,articleTracking, ModuleTracking,  quizTracking,batches, bootcamps} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql, inArray, and } from 'drizzle-orm';
import axios from 'axios';
import { error, log } from 'console';

const {ZUVY_CONTENT_URL, ZUVY_CONTENTS_API_URL} = process.env// INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class TrackingService {
    async getProgress(user_id: number, module_id: number) {
        try{
            const response = await axios.get(`${ZUVY_CONTENTS_API_URL}/zuvy-modules/${module_id}?populate=zuvy_articles&populate=zuvy_mcqs.quiz.qz`);
            let zuvy_articles = response.data.data.attributes.zuvy_articles
            let zuvy_mcqs = response.data.data.attributes.zuvy_mcqs
            let zuvy_mcqs_ids = zuvy_mcqs.data.map(mcq => mcq.id);
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
            
            let getModuleTracking = await db.select().from(ModuleTracking).where(sql`${ModuleTracking.userId} = ${user_id} and ${ModuleTracking.moduleId} = ${module_id}`);
            if (getModuleTracking.length == 0) {
                let insertModuleTracking = await db.insert(ModuleTracking).values({userId: user_id, moduleId: module_id, progress: progress}).returning();
            } else {
                let updateModuleTracking = await db.update(ModuleTracking).set({progress: progress}).where(sql`${ModuleTracking.userId} = ${user_id} and ${ModuleTracking.moduleId} = ${module_id}`).returning();
            }
            log(`update the progress of the user_id:${user_id}, ${progress}`)
            
            return [null, {progress}]
        } catch (e){
            error(`ERROR: ${e.massage}  user_id:${user_id}`)
            return [{ status: 'error', message: e.message, code: 402 }];
        }
    }

    // Create
    async submissionAssignment(data: any) {
        try {
            const res = await db.select().from(assignmentSubmission).where(sql`${assignmentSubmission.userId} = ${data.userId} and ${assignmentSubmission.assignmentId} = ${data.assignmentId}`);

            if (res.length == 0) {
                const result = await db.insert(assignmentSubmission).values(data).returning();
                return [null, result[0]];
            }
            await this.getProgress(data.userId, data.moduleId);
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
    async createArticleTracking(data: any) {
        try {
            const artical = await db.select().from(articleTracking).where(sql`${articleTracking.articleId} = ${data.articleId} and ${articleTracking.userId} = ${data.userId}`);
            if (artical.length == 0){
                const result = await db.insert(articleTracking).values(data).returning();
                await this.getProgress(data.userId, data.moduleId);
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
    async createQuizTracking(data: any) {
        try {
            const result = await db.insert(quizTracking).values(data).returning();
            await this.getProgress(data.userId, data.moduleId);
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
}