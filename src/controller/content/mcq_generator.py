"""
mcq_generator_to_zuvy_json.py

Generate MCQs using LLM (Gemini) and print them as a JSON array in format:
[topic, difficulty, question_text, options, answer]

Uses PostgreSQL only to fetch embeddings from zuvy_module_quiz_variants for
duplicate filtering via cosine similarity.
"""
import subprocess
import sys
import os
import json
#import psycopg2
#import numpy as np
#from sentence_transformers import SentenceTransformer
#from dotenv import load_dotenv
from typing import List, Dict, Any, Tuple
#from google import genai

# --------------------------------------------------------
# Configuration
# --------------------------------------------------------
# load_dotenv()

# DB_HOST = os.getenv("DB_HOST", "localhost")
# DB_PORT = int(os.getenv("DB_PORT", 5432))
# DB_NAME = os.getenv("DB_NAME", "mcqdb")
# DB_USER = os.getenv("DB_USER", "postgres")
# DB_PASSWORD = os.getenv("DB_PASS", "1")

os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY", "AIzaSyAFuU4BE7voM9h3RIduHS2Qc36TjMd6QnM")
SIMILARITY_THRESHOLD = 0.86
EMBED_MODEL_NAME = "all-MiniLM-L6-v2"

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1ODM1MyIsImVtYWlsIjoic3VrYW55YW1vaGFudHlAbmF2Z3VydWt1bC5vcmciLCJnb29nbGVVc2VySWQiOiIxMDI1MzkzNzgwNzI3NTUwMDg4NjMiLCJyb2xlIjoid2ViIiwicm9sZXNMaXN0IjpbIkFkbWluIl0sImlhdCI6MTc2MTA3NDg3OCwiZXhwIjoxNzYxMTYxMjc4fQ.m6vTKsIvM1jkoyGl_8H3OectVIohugGcnPgHNCH8LGQ")
#embed_model = SentenceTransformer(EMBED_MODEL_NAME)

# --------------------------------------------------------
# Helper Functions
# --------------------------------------------------------
def install_requirements():
    try:
        result = subprocess.run(
            ['pip', 'install', 'requests','google-genai'],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        #print("Installation successful:\n", result.stdout)
    except subprocess.CalledProcessError as e:
        print("Installation failed:\n", e.stderr)


def build_prompt(difficulty: str, topics: Dict[str, int], audience: str, previous_assessment: Dict[str, Any] = None) -> str:
    topic_lines = "\n".join([f"- {topic}: {count} question(s)" for topic, count in topics.items()])
    prev_data_str = ""
    if previous_assessment:
        # Convert the assessment data into a readable, compact JSON string
        prev_data_str = json.dumps(previous_assessment, indent=2, ensure_ascii=False)
        prev_data_str = f"\n\nBelow is the JSON data from the previous assessment. Use it as a reference to customize assessments based on the average performance of the previous assessment:\n\n{prev_data_str}\n"

    
    return f"""
Generate high-quality multiple-choice questions in JSON format.

Parameters:
1. Difficulty level: {difficulty}
2. Topics:
{topic_lines}
3. Audience: {audience}
{prev_data_str}

Each item must be JSON like:
[
  {{
    "topic": "<topic>",
    "difficulty": "<difficulty>",
    "question": "<the question>",
    "options": ["A", "B", "C", "D"],
    "answer": "<the correct answer text>"
  }}
]

Guidelines:
- Avoid repeating questions from the previous assessment.
- Ensure clarity, correctness, and balanced difficulty.
- Use consistent formatting (no HTML tags or extra text).
- Do NOT include explanations or any text outside the JSON array.
"""


def send_to_llm(prompt: str) -> str:
    from google import genai
    client = genai.Client()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )
    return response.text


def parse_json(text: str):
    """Extract JSON array from LLM output"""
    start, end = text.find("["), text.rfind("]")
    if start == -1 or end == -1:
        raise ValueError("No valid JSON array found in LLM output.")
    return json.loads(text[start:end + 1])


def embed_texts(texts: List[str]):
    """Return normalized embeddings"""
    embs = embed_model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    return embs


def cosine(a, b):
    return float(np.dot(a, b))


# --------------------------------------------------------
# Database Helpers
# --------------------------------------------------------
def get_conn():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT,
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD
    )


def fetch_existing_embeddings(conn):
    """Fetch embeddings from zuvy_module_quiz_variants"""
    with conn.cursor() as cur:
        cur.execute("SELECT embeddings FROM zuvy_module_quiz_variants WHERE embeddings IS NOT NULL;")
        rows = cur.fetchall()
    embeddings = []
    for (emb,) in rows:
        if emb:
            emb_arr = np.array(emb, dtype=float)
            emb_arr /= np.linalg.norm(emb_arr) if np.linalg.norm(emb_arr) else 1
            embeddings.append(emb_arr)
    return embeddings


def get_previous_assessment_data(bootcamp_id: str) -> Dict[str, Any]:
    import requests
    url = f"https://dev.api.zuvy.org/admin/assessment-performance/{bootcamp_id}"
    headers = {
        'accept': '*/*',
        'Authorization': f'Bearer {JWT_SECRET_KEY}',
        'Content-Type': 'application/json'
    }
    response = requests.request("GET", url, headers=headers)
    return response.json()




# --------------------------------------------------------
# Main Logic
# --------------------------------------------------------
def generate_mcqs_as_json(difficulty: str, topics: Dict[str, int], audience: str, bootcamp_id: str):
    previous_assessment = get_previous_assessment_data(bootcamp_id)
    prompt = build_prompt(difficulty, topics, audience, previous_assessment)
    raw = send_to_llm(prompt)
    mcqs = parse_json(raw)

    # conn = get_conn()
    # existing_embeddings = fetch_existing_embeddings(conn)
    # conn.close()
    #print(f"Fetched {len(existing_embeddings)} embeddings from DB for duplicate check.")

    # Compute embeddings for generated MCQs
    # question_texts = [m["question"] for m in mcqs]
    # generated_embs = embed_texts(question_texts)

    # unique_mcqs = []
    # for i, q in enumerate(mcqs):
    #     q_emb = generated_embs[i]
    #     duplicate_found = False
    #     for ex_emb in existing_embeddings:
    #         if cosine(q_emb, ex_emb) >= SIMILARITY_THRESHOLD:
    #             duplicate_found = True
    #             break
    #     if not duplicate_found:
    #         unique_mcqs.append([
    #             q.get("topic"),
    #             q.get("difficulty"),
    #             q.get("question").strip(),
    #             q.get("options"),
    #             q.get("answer")
    #         ])

    print(json.dumps(mcqs, indent=2, ensure_ascii=False))
    #print(f"\n✅ Unique: {len(unique_mcqs)} | ❌ Duplicates Removed: {len(mcqs) - len(unique_mcqs)}")


# --------------------------------------------------------
# Run Example
# --------------------------------------------------------
if __name__ == "__main__":
    #install_requirements()
    difficulty = "Medium"
    topics = {"Arrays": 4, "Loops": 3}
    audience = "Assessment for AFE cohort, semester 2 and 3 CSE"
    try:
        if len(sys.argv) >= 2:
            # Read and parse the JSON input from command-line argument
            input_data = json.loads(sys.argv[1])
            bootcamp_id = input_data.get("bootcampid")
            difficulty = input_data.get("difficulty")
            topics = input_data.get("topics")
            audience = input_data.get("audience")
        else:
            bootcamp_id = 803
    except Exception as e:
        bootcamp_id = 803

    generate_mcqs_as_json(difficulty, topics, audience, bootcamp_id)
