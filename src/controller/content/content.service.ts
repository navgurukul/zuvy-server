import { Injectable, Logger } from '@nestjs/common';
import { moduleTracking, assignmentSubmission, articleTracking, quizTracking } from '../../../drizzle/schema';
import axios from 'axios';
import { error, log } from 'console';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index';
import { promises } from 'dns';
// import Strapi from "strapi-sdk-js"

const {ZUVY_CONTENT_URL, ZUVY_CONTENTS_API_URL} = process.env// INPORTING env VALUSE ZUVY_CONTENT

// const strapi = new Strapi({url: ZUVY_CONTENTS_API_URL})
@Injectable()
export class ContentService {

    async lockContent(modules__, module_id= null){
        let index = 0;
        while (index < modules__.length) {
            let index_run = index + 1;
            if (index == 0) {
                modules__[index]['lock'] = true;
            }
            if (index_run < modules__.length) {
                if (modules__[index].progress >= 100) {
                    modules__[index_run]['lock'] = true;
                } else {
                    modules__[index_run]['lock'] = false;
                }
            }
            index++;
        }
        return modules__;
    }

    async getModules(bootcamp_id, user_id) {
        try{
            let respo = await axios.get(ZUVY_CONTENT_URL+`/${bootcamp_id}?populate=zuvy_modules`);
            let modules = respo.data.data.attributes.zuvy_modules.data;

            // if (user_id){    
                let modulePromises = modules.map(async (m) => {
                    if (user_id) { 
                        let getModuleTracking = await db.select().from(moduleTracking).where(sql`${moduleTracking.userId} = ${user_id} and ${moduleTracking.moduleId} = ${m.id}`);
                        if (getModuleTracking.length == 0) {
                            m.attributes['progress'] = 0
                        } else {
                            m.attributes['progress'] = getModuleTracking[0].progress || 0;
                        }
                    }
                    return {
                        id: m.id,
                        ...m.attributes
                    };
                });

                modules = await Promise.all(modulePromises);
                modules = await this.lockContent(modules);
            // }
            return [null, modules];
        } catch (err) {
            error(`Error posting data: ${err.message}`)
            return [{'status': 'error', 'message': err.message,'code': 500}, null];
        }
    }
    async getChapter(module_id: number, user_id: number) {
        try {
            const response = await axios.get(`${ZUVY_CONTENTS_API_URL}/zuvy-modules/${module_id}?populate=zuvy_articles&populate=zuvy_mcqs.quiz.qz`);
            const zuvy_articles = response.data.data.attributes.zuvy_articles.data;
            const zuvy_mcqs = response.data.data.attributes.zuvy_mcqs;
            interface QuizItem {
                id: number;
                question: string;
                qz: { number: number; value: { children: { text: string }[] }[]; correct: boolean }[];
            }
            
            interface McqItem {
                attributes: any;
                id: number;
                label: string;
                quiz: QuizItem[];
            }
            const formattedData = zuvy_mcqs.data.map((item: McqItem) => {
                const questions = item.attributes.quiz.map((quizItem: QuizItem) => {
                    const options = quizItem.qz.map((q) => ({
                        text: q.value[0].children[0].text,
                        correct: q.correct,
                        number: q.number
                    }));
                    return { id: quizItem.id, question: quizItem.question, options };
                });
                return { id: item.id, label: item.attributes.label, index: item.attributes.index, questions };
            });
            const formattedArticles = zuvy_articles.map((article: any) => ({
                id: article.id,
                ...article.attributes
            }));
    
            let chapter = [...formattedArticles, ...formattedData];

            if (user_id) {
                const getModuleTracking = await db.select().from(moduleTracking).where(sql`${moduleTracking.userId} = ${user_id} and ${moduleTracking.moduleId} = ${module_id}`);
                if (getModuleTracking.length == 0) {
                    chapter['progress'] = 0;
                } else {
                    chapter['progress'] = getModuleTracking[0].progress || 0;
                }

                let promises = chapter.map(async (c) => {
                    if (c.label == 'article') {
                        let getArticleTracking = await db.select().from(articleTracking).where(sql`${articleTracking.userId} = ${user_id} and ${articleTracking.moduleId} = ${module_id} and ${articleTracking.articleId} = ${c.id}`);
                        if (getArticleTracking.length == 0) {
                            c['completed'] = false;
                        } else {
                            c['completed'] = true;
                        }
                    } else if (c.label == 'assignment') {
                        let getAssignmentSubmission = await db.select().from(assignmentSubmission).where(sql`${assignmentSubmission.userId} = ${user_id} and ${assignmentSubmission.moduleId} =  ${module_id} and ${assignmentSubmission.assignmentId} = ${c.id}`);
                        if (getAssignmentSubmission.length == 0) {
                            c['completed'] = false;
                        } else {
                            c['completed'] = true;
                        }
                    } else if (c.label == 'quiz') {
                        let getQuizSubmission = await db.select().from(quizTracking).where(sql`${quizTracking.userId} = ${user_id} and ${quizTracking.moduleId} = ${module_id} and ${quizTracking.quizId} = ${c.id}`);
                        if (getQuizSubmission.length == 0) {
                            c['completed'] = false;
                        } else {
                            c['completed'] = true;
                        }
                    }
                    return c;
                });
                
                chapter = await Promise.all(promises);
            }
    
            return [null, chapter];
        } catch (err) {
            error(`Error posting data: ${err.message}`);
            return [{ 'status': 'error', 'message': err.message, 'code': 500 }, null];
        }
    }
}