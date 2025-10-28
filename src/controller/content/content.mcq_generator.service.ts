import { Injectable } from '@nestjs/common';
import { AdminAssessmentService } from '../adminAssessment/adminAssessment.service';
import * as dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { db } from 'src/db';
import { zuvyAIGeneratedQuestions, zuvyQuestionSets } from 'drizzle/schema';
dotenv.config();
interface TopicCount {
  [topic: string]: number;
}

interface PreviousAssessment {
  [key: string]: any;
}

interface MCQ {
  topic: string;
  difficulty: string;
  question: string;
  options: string[];
  answer: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });
@Injectable()
export class MCQGeneratorService {
  constructor(
    private readonly adminAssessmentService: AdminAssessmentService,
  ) {}
  async buildPrompt(
    difficulty: string,
    topics: TopicCount,
    audience: string,
    previousAssessment?: PreviousAssessment,
  ): Promise<string> {
    const topicLines = Object.entries(topics)
      .map(([topic, count]) => `- ${topic}: ${count} question(s)`)
      .join('\n');

    let prevDataStr = '';
    if (previousAssessment) {
      const prevDataJson = JSON.stringify(previousAssessment, null, 2);
      prevDataStr = `

      Below is the JSON data from the previous assessment. Use it as a reference to customize assessments based on the average performance of the previous assessment:

      ${prevDataJson}
      `;
    }

    return `
      Generate high-quality multiple-choice questions in JSON format.

      Parameters:
      1. Difficulty level: ${difficulty}
      2. Topics:
      ${topicLines}
      3. Audience: ${audience}
      ${prevDataStr}

      Each item must be JSON like:
      [
        {
          "topic": "<topic>",
          "difficulty": "<difficulty>",
          "question": "<the question>",
          "options": ["A", "B", "C", "D"],
          "answer": "<the correct answer text>"
        }
      ]

      Guidelines:
      - Avoid repeating questions from the previous assessment.
      - Ensure clarity, correctness, and balanced difficulty.
      - Use consistent formatting (no HTML tags or extra text).
      - Do NOT include explanations or any text outside the JSON array.
      `;
  }

  /**
   * Send prompt to Gemini using @google/genai
   */
  async sendToLLM(prompt: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text ?? '';
  }

  /**
   * Extract JSON array from LLM output safely
   */
  async parseJson(text: string): Promise<MCQ[]> {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1) {
      throw new Error('No valid JSON array found in LLM output.');
    }
    return JSON.parse(text.slice(start, end + 1));
  }

  /**
   * Fetch previous assessment data from API
   */
  async getPreviousAssessmentData(
    bootcampId: number,
  ): Promise<PreviousAssessment> {
    const response =
      await this.adminAssessmentService.getAssessmentStats(bootcampId);
    return response;
  }

  /**
   * Main function — orchestrates MCQ generation
   */
  async generateMCQsAsJson(
    difficulty: string,
    topics: TopicCount,
    audience: string,
    bootcampId: number,
  ): Promise<MCQ[]> {
    const previousAssessment = await this.getPreviousAssessmentData(bootcampId);
    const prompt = await this.buildPrompt(
      difficulty,
      topics,
      audience,
      previousAssessment,
    );
    const rawOutput = await this.sendToLLM(prompt);
    const mcqs = await this.parseJson(rawOutput);

    console.log(JSON.stringify(mcqs, null, 2));

    // ✅ STORE MCQs IN DATABASE
    await this.storeMCQsInDatabase(
      mcqs,
      bootcampId,
      difficulty,
      topics,
      audience,
    );

    return mcqs;
  }

  async storeMCQsInDatabase(
    mcqs: MCQ[],
    bootcampId: number,
    difficulty: string,
    topics: TopicCount,
    audience: string,
  ): Promise<void> {
    try {
      const payLoad = {
        bootcampId,
        difficulty,
        topics,
        audience,
        generatedAt: new Date(),
      };

      // Transaction use karein for data consistency
      await db.transaction(async (tx) => {
        // 1. Create question set
        const [questionSet] = await tx
          .insert(zuvyQuestionSets)
          .values(payLoad)
          .returning();

        if (!questionSet) {
          throw new Error('Failed to create question set');
        }

        // 2. Insert questions one by one ya batch mein
        const questionsData = mcqs.map((mcq) => ({
          questionSetId: questionSet.id,
          topic: mcq.topic,
          difficulty: mcq.difficulty,
          question: mcq.question,
          options: mcq.options, // JSONB
          correctOption: mcq.answer, // Column name 'correctOption' hai
          isActive: true,
          // createdAt aur updatedAt automatically handle honge
        }));

        // 3. Single batch insert
        const insertedQuestions = await tx
          .insert(zuvyAIGeneratedQuestions)
          .values(questionsData)
          .returning();
      });

      console.log(
        `✅ Successfully stored ${mcqs.length} MCQs for bootcamp ${bootcampId}`,
      );
    } catch (error) {
      console.error('Error storing MCQs in database:', error);
      throw new Error(`Failed to store MCQs: ${error.message}`);
    }
  }
}
