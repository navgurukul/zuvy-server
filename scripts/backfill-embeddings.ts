import { db } from '../src/db/index';
import { zuvyCodingQuestions } from '../drizzle/schema';
import OpenAI from 'openai';
import { sql } from 'drizzle-orm';
// Remove unused import
// import { helperVariable } from '../src/constants/helper';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: texts,
  });
  return response.data.map(item => item.embedding);
}

async function backfillEmbeddings(batchSize = 10) {
  let totalUpdated = 0;
  while (true) {
    const questions = await db.select().from(zuvyCodingQuestions)
      .where(sql`${zuvyCodingQuestions.embedding} IS NULL`)
      .limit(batchSize);
    if (questions.length === 0) break;
    
    try {
      // Batch embedding generation
      const texts = questions.map(q => `${q.title} ${q.description}`);
      const embeddings = await getEmbeddings(texts);
      
      // Update all questions in the batch
      for (let i = 0; i < questions.length; i++) {
        await db.update(zuvyCodingQuestions).set({ embedding: embeddings[i] } as any)
          .where(sql`${zuvyCodingQuestions.id} = ${questions[i].id}`);
        totalUpdated++;
        console.log(`Updated embedding for question id ${questions[i].id}`);
      }
    } catch (e: any) {
      console.error(`Failed to backfill embeddings for batch: ${e.message}`);
      // If batch fails, try individual questions
      for (const q of questions) {
        try {
          const emb = await getEmbeddings([`${q.title} ${q.description}`]);
          await db.update(zuvyCodingQuestions).set({ embedding: emb[0] } as any)
            .where(sql`${zuvyCodingQuestions.id} = ${q.id}`);
          totalUpdated++;
          console.log(`Updated embedding for question id ${q.id}`);
        } catch (e: any) {
          console.error(`Failed to backfill embedding for question id ${q.id}: ${e.message}`);
        }
      }
    }
    
    // Delay to avoid rate limits
    await new Promise(res => setTimeout(res, 2000));
  }
  console.log(`Backfill complete. Total updated: ${totalUpdated}`);
}

backfillEmbeddings().then(() => process.exit(0)); 