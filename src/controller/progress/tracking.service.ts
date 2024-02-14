import { Injectable, Logger } from '@nestjs/common';
import { assignmentSubmission,articleTracking, quizTracking,batches, bootcamps} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql, } from 'drizzle-orm';
import axios from 'axios';
import { error, log } from 'console';

const {ZUVY_CONTENT_URL, ZUVY_CONTENTS_API_URL} = process.env// INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class TrackingService {
    
    async getProgress(userId: number){
        try{
            let respo = await axios.get(ZUVY_CONTENTS_API_URL+ '/zuvy-contents/9?populate=zuvy_modules')
            let modules = respo.data.data

            
            return [null, modules]
        } catch (err){
            return [{status: 'error', massage: err.massage, code: 402}]
        }
    }


    // Create
    async createAssignmentSubmission(data: any) {
        try {
            const res = await db.select().from(assignmentSubmission).where(sql`${assignmentSubmission.userId} = ${data.userId} and ${assignmentSubmission.assignmentId} = ${data.assignmentId}`);

            if (res.length == 0) {
                const result = await db.insert(assignmentSubmission).values(data).returning();
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
    async createArticleTracking(data: any) {
        try {
            const artical = await db.select().from(articleTracking).where(sql`${articleTracking.articleId} = ${data.articleId} and ${articleTracking.userId} = ${data.userId}`);
            if (artical.length == 0){
                const result = await db.insert(articleTracking).values(data).returning();
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