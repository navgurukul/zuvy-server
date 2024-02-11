import { Injectable, Logger } from '@nestjs/common';

import axios from 'axios';
import { error, log } from 'console';

const {ZUVY_CONTENT_URL, ZUVY_CONTENTS_API_URL} = process.env// INPORTING env VALUSE ZUVY_CONTENT

@Injectable()
export class ContentService {
    async getModules(bootcamp_id){
        try{
            let respo = await axios.get(ZUVY_CONTENT_URL+`/${bootcamp_id}?populate=zuvy_modules`)
            let modules = respo.data.data.attributes.zuvy_modules.data
            
            modules = modules.map(m => {
                return {
                    id: m.id,
                    ...m.attributes
                }
            })

            return [null, modules]
        } catch (err) {
            error(`Error posting data: ${err.message}`)
            return [{'status': 'error', 'message': err.message,'code': 500}, null];
        }
    }
    async getChapter(module_id: number) {
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
    
            const chapter = [...formattedArticles, ...formattedData];
    
            return [null, chapter];
        } catch (err) {
            error(`Error posting data: ${err.message}`);
            return [{ 'status': 'error', 'message': err.message, 'code': 500 }, null];
        }
    }
}