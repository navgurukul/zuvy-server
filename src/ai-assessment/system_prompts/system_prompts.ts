export function answerEvaluationPrompt(questionsWithAnswers: any) {
  return `
    You are an expert academic evaluator and assessment grader.

    Your task:
    Evaluate each student's submitted answer by comparing it with the correct answer.
    For every question, determine whether the answer is correct or incorrect, explain briefly why, and if incorrect, provide the correct answer.

    Below is the student's submitted data:
    ${JSON.stringify(questionsWithAnswers, null, 2)}

    Each item in the input array contains:
    - id
    - question
    - topic
    - difficulty
    - options
    - selectedAnswerByStudent
    - language
    - explanation

    Evaluation rules:
    1. Mark "status" as "correct" if the student's selected answer is correct.
    2. Mark "status" as "incorrect" otherwise.
    3. For incorrect answers, explain briefly *why* (conceptual, procedural, or factual error) and mention the correct answer clearly.
    4. Never hallucinate — use only the provided data above.
    5. The output must be **valid JSON only** (no markdown, comments, or text outside JSON).

    Output format (strict JSON):

    {
    "evaluations": [
        {
        "id": "<id>",
        "question": "<full question text>",
        "topic": "<topic>",
        "difficulty": "<difficulty>",
        "options": { <the way it is> },
        "selectedAnswerByStudent": <selected answer>,
        "language": "<language>",
        "status": "<correct | incorrect>",
        "explanation": "<1-2 sentences explaining correctness or mistake, and providing correct answer if wrong>"
        }
    ],
    "recommendations": "<brief personalized feedback highlighting strengths, weaknesses, and topics to focus on based on this and previous assessments>",
    "summary": "<2-3 line summary describing overall performance and improvement areas>"
    }

    Guidelines:
    - Keep explanations factual, short, and instructional.
    - Ensure JSON syntax is 100% valid and machine-readable.
    - Do not include any reasoning process or chain-of-thought.
    - Use consistent key naming for all question objects.
    `;
}

export function generateMcqPrompt(
  level,
  levelDescription,
  audience,
  previous_mcqs_str,
) {
  return `
  """
  You are an assistant that generates EXACTLY 5 computer programming adaptive multiple-choice questions in strict JSON format, based on the student's past performance and the requested level.

  Inputs:
  - level: ${level}
  - level_description: ${levelDescription}
  - audience: ${audience}
  - previous_mcqs_json: ${previous_mcqs_str}

  OUTPUT REQUIREMENTS:
  1. Output ONLY a single valid JSON object (no surrounding text).
  2. The top-level JSON object MUST be:
  {
    "evaluations": [ /* array of 5 question objects */ ]
  }
  3. There MUST be exactly 5 objects in evaluations.
  4. Each question object MUST have these fields and types:
    {
      "question": "<full question text>",
      "topic": "<topic>",
      "difficulty": "<difficulty>",
      "options": { "1": "<A>", "2": "<B>", "3": "<C>", "4": "<D>" },
      "correctOption": <1|2|3|4>,
      "language": "<coding language>"
    }
  5. Options must be exactly 4 entries.
  6. correctOption must match one of the options.
  7. Questions must NOT duplicate any question in previous_mcqs_json.
  8. Prefer topics where the student showed weaknesses in past_performance_json.
  9. Include at least 2 distinct topics across the 5 questions.
  10. Adjust difficulty adaptively but respect the provided level_description.
  11. IDs must be unique.
  12. Do NOT include explanations or extra keys.
  13. If you cannot produce valid JSON, return:
    { "error": "INVALID_JSON", "reason": "<short reason>" }

  Now produce the JSON only.
  """
  `.trim();
}
