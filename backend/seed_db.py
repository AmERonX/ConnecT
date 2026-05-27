import os
import uuid
import asyncio
import httpx
import asyncpg
from dotenv import load_dotenv

# Load backend env variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

SUPABASE_DB_URL = os.getenv('SUPABASE_DB_URL')
COHERE_API_KEY = os.getenv('COHERE_API_KEY')

mock_builders = [
    {
        "name": "Aarav Sharma",
        "email": "aarav.sharma@mock.connect.app",
        "github_url": "https://github.com/aaravs",
        "team_size_preference": 4,
        "working_style": "sync",
        "has_existing_team": False,
        "skills": [
            {"skill_name": "React", "level": "advanced"},
            {"skill_name": "Node.js", "level": "intermediate"},
            {"skill_name": "PostgreSQL", "level": "intermediate"}
        ],
        "idea": {
            "title": "DevPortfolio Builder",
            "problem": "Developers spend too much time coding custom portfolios instead of working on actual side projects or studies.",
            "solution_idea": "An interactive command-line and web tool that builds a highly interactive, 3D animated developer portfolio directly from a user's GitHub profile in seconds.",
            "approach": "Query the GitHub GraphQL API, parse repos and contributions, and feed that data into pre-built Next.js and Three.js dashboard templates.",
            "tags": ["Web Development", "CLI", "React"],
            "required_skills": ["Three.js", "Next.js", "GraphQL"],
            "commitment_hrs": 10,
            "duration_weeks": 4,
            "commitment_level": "serious"
        }
    },
    {
        "name": "Priya Patel",
        "email": "priya.patel@mock.connect.app",
        "github_url": "https://github.com/priyap",
        "team_size_preference": 3,
        "working_style": "async",
        "has_existing_team": False,
        "skills": [
            {"skill_name": "Python", "level": "advanced"},
            {"skill_name": "PyTorch", "level": "intermediate"},
            {"skill_name": "Scikit-Learn", "level": "advanced"}
        ],
        "idea": {
            "title": "MentalHealth MoodTracker",
            "problem": "Mental health conditions and burnout are often diagnosed late because individuals don't track subtle changes in mood or behaviour.",
            "solution_idea": "A privacy-first mobile application that uses local, on-device audio classification and diary text analysis to detect early signs of burnout.",
            "approach": "Build a Flutter application, implement local ONNX-runtime ML models for audio tone analysis, and use local database storage to ensure user privacy.",
            "tags": ["Mobile App", "Machine Learning", "NLP"],
            "required_skills": ["Flutter", "ONNX", "Mobile Development"],
            "commitment_hrs": 15,
            "duration_weeks": 8,
            "commitment_level": "startup_seed"
        }
    },
    {
        "name": "Vikram Singh",
        "email": "vikram.singh@mock.connect.app",
        "github_url": "https://github.com/vikrams",
        "team_size_preference": 2,
        "working_style": "flexible",
        "has_existing_team": False,
        "skills": [
            {"skill_name": "Swift", "level": "advanced"},
            {"skill_name": "Kotlin", "level": "intermediate"},
            {"skill_name": "Firebase", "level": "intermediate"}
        ],
        "idea": {
            "title": "CampusFood Runner",
            "problem": "Long cafeteria lines on university campuses cause students to miss meals or arrive late to lectures.",
            "solution_idea": "A crowd-sourced food delivery app for university campuses where students order food and peer runners deliver it for small fees.",
            "approach": "Native iOS app with Swift, real-time Firestore database for location tracking, and Stripe integration for quick payments.",
            "tags": ["Mobile App", "iOS", "Firebase"],
            "required_skills": ["Swift", "Firebase", "iOS"],
            "commitment_hrs": 5,
            "duration_weeks": 6,
            "commitment_level": "casual"
        }
    },
    {
        "name": "Nisha Gupta",
        "email": "nisha.gupta@mock.connect.app",
        "github_url": "https://github.com/nishag",
        "team_size_preference": 4,
        "working_style": "sync",
        "has_existing_team": False,
        "skills": [
            {"skill_name": "Figma", "level": "advanced"},
            {"skill_name": "CSS/HTML", "level": "advanced"},
            {"skill_name": "Tailwind CSS", "level": "advanced"}
        ],
        "idea": {
            "title": "NoCode WebAnimation Builder",
            "problem": "Creative UI/UX designers cannot easily add advanced canvas or SVG animations to their webs without coding complex JavaScript.",
            "solution_idea": "A visual drag-and-drop web editor that generates clean, optimized GSAP (GreenSock) and SVG animation code.",
            "approach": "Build a responsive web application using Tailwind, Vanilla CSS, GSAP integration, and HTML5 canvas exporting utilities.",
            "tags": ["UI/UX", "Design Tools", "GSAP"],
            "required_skills": ["JavaScript", "GSAP", "Figma"],
            "commitment_hrs": 8,
            "duration_weeks": 4,
            "commitment_level": "portfolio"
        }
    },
    {
        "name": "Rohan Das",
        "email": "rohan.das@mock.connect.app",
        "github_url": "https://github.com/rohand",
        "team_size_preference": 5,
        "working_style": "flexible",
        "has_existing_team": False,
        "skills": [
            {"skill_name": "Go", "level": "advanced"},
            {"skill_name": "Docker", "level": "advanced"},
            {"skill_name": "AWS", "level": "intermediate"}
        ],
        "idea": {
            "title": "Serverless Event Bus",
            "problem": "Existing cloud message queues (like AWS SQS) are difficult to run and test locally, causing slow developer feedback loops.",
            "solution_idea": "A local-first, containerized event bus with a sleek web UI, mimicking SNS/SQS but with zero latency.",
            "approach": "Write the event core in Go, package with Docker, and construct a lightweight React web console for visual logs.",
            "tags": ["DevOps", "Go", "Infrastructure"],
            "required_skills": ["Go", "Docker", "React"],
            "commitment_hrs": 12,
            "duration_weeks": 5,
            "commitment_level": "serious"
        }
    },
    {
        "name": "Ananya Iyer",
        "email": "ananya.iyer@mock.connect.app",
        "github_url": "https://github.com/ananyai",
        "team_size_preference": 3,
        "working_style": "async",
        "has_existing_team": False,
        "skills": [
            {"skill_name": "Solidity", "level": "advanced"},
            {"skill_name": "Rust", "level": "intermediate"},
            {"skill_name": "Web3.js", "level": "intermediate"}
        ],
        "idea": {
            "title": "Decentralized Escrow",
            "problem": "Freelancers are frequently scammed or experience delayed payments from clients they meet online.",
            "solution_idea": "A smart-contract based escrow platform that locks project funds and resolves disputes via a peer-jury system.",
            "approach": "Solidity smart contracts on EVM chains, a Rust backend for Oracle network integration, and a React frontend.",
            "tags": ["Web3", "Solidity", "Rust"],
            "required_skills": ["Solidity", "Rust", "Web3.js"],
            "commitment_hrs": 16,
            "duration_weeks": 8,
            "commitment_level": "startup_seed"
        }
    }
]

async def generate_embedding(text: str) -> list[float]:
    print(f"Generating embedding for: {text[:40]}...")
    url = "https://api.cohere.com/v2/embed"
    headers = {
        "Authorization": f"Bearer {COHERE_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "texts": [text],
        "model": "embed-english-v3.0",
        "input_type": "search_document",
        "embedding_types": ["float"]
    }
    
    async with httpx.AsyncClient() as client:
        # Try once
        resp = await client.post(url, headers=headers, json=payload, timeout=15.0)
        if resp.status_code != 200:
            # Try retry
            print(f"Cohere failed with status {resp.status_code}. Retrying...")
            await asyncio.sleep(2)
            resp = await client.post(url, headers=headers, json=payload, timeout=15.0)
            if resp.status_code != 200:
                raise Exception(f"Cohere API failed: {resp.status_code} - {resp.text}")
                
        data = resp.json()
        return data["embeddings"]["float"][0]

async def seed():
    if not SUPABASE_DB_URL:
        print("Error: SUPABASE_DB_URL env variable not found.")
        return
        
    if not COHERE_API_KEY:
        print("Error: COHERE_API_KEY env variable not found.")
        return

    print("Connecting to Supabase PostgreSQL database...")
    conn = await asyncpg.connect(SUPABASE_DB_URL, statement_cache_size=0)
    
    rls_tables = ["users", "user_skills", "project_ideas", "idea_embeddings", "matches", "match_participants"]
    
    try:
        # Disable RLS temporarily
        print("Temporarily disabling Row Level Security for seed data...")
        for table in rls_tables:
            await conn.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

        # Fix the database bug in update_stale_matches if present (variables level_a and level_b shadow table columns)
        print("Deploying fixed update_stale_matches function...")
        await conn.execute("""
CREATE OR REPLACE FUNCTION update_stale_matches(batch_limit INT DEFAULT 50)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count INT := 0;
  match_row RECORD;
  sim FLOAT;
  
  -- Sub-scores and intermediate variables
  skills_a text[];
  skills_b text[];
  required_skills_a text[];
  required_skills_b text[];
  skill_comp_a float;
  skill_comp_b float;
  avg_skill_comp float;
  
  v_commit_compat float;
  
  -- Weights
  w_embedding float := 0.5;
  w_skill float := 0.3;
  w_commit float := 0.2;
  v_score_version int := 1;
  v_blend_score float;
BEGIN
  -- Fetch weights once
  SELECT COALESCE(MAX(CASE WHEN key = 'weight_embedding' THEN value END), 0.5) INTO w_embedding FROM match_config;
  SELECT COALESCE(MAX(CASE WHEN key = 'weight_skill' THEN value END), 0.3) INTO w_skill FROM match_config;
  SELECT COALESCE(MAX(CASE WHEN key = 'weight_commit' THEN value END), 0.2) INTO w_commit FROM match_config;
  SELECT COALESCE(MAX(CASE WHEN key = 'score_version' THEN ROUND(value)::int END), 1) INTO v_score_version FROM match_config;

  FOR match_row IN
    SELECT m.id, m.idea_a_id, m.idea_b_id, 
           pi_a.user_id as user_a_id, pi_b.user_id as user_b_id,
           pi_a.required_skills as req_skills_a, pi_b.required_skills as req_skills_b,
           pi_a.commitment_level as lvl_a, pi_b.commitment_level as lvl_b,
           pi_a.is_active as is_a_active, pi_b.is_active as is_b_active
    FROM matches m
    JOIN project_ideas pi_a ON pi_a.id = m.idea_a_id
    JOIN project_ideas pi_b ON pi_b.id = m.idea_b_id
    WHERE m.is_stale = true
    LIMIT batch_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    IF NOT match_row.is_a_active OR NOT match_row.is_b_active THEN
      UPDATE matches SET is_stale = false WHERE id = match_row.id;
      CONTINUE;
    END IF;

    -- 1. Compute embedding cosine similarity
    SELECT 1 - (e1.embedding <=> e2.embedding) INTO sim
    FROM idea_embeddings e1, idea_embeddings e2
    WHERE e1.idea_id = match_row.idea_a_id
      AND e2.idea_id = match_row.idea_b_id
      AND e1.embedding_type = 'full'
      AND e2.embedding_type = 'full';

    IF sim IS NOT NULL THEN
      -- 2. Compute skill complementarity
      SELECT COALESCE(ARRAY_AGG(skill_name), '{}') INTO skills_a FROM user_skills WHERE user_id = match_row.user_a_id;
      SELECT COALESCE(ARRAY_AGG(skill_name), '{}') INTO skills_b FROM user_skills WHERE user_id = match_row.user_b_id;
      
      skill_comp_a := skill_complement_score(match_row.req_skills_a, skills_b);
      skill_comp_b := skill_complement_score(match_row.req_skills_b, skills_a);
      avg_skill_comp := (skill_comp_a + skill_comp_b) / 2.0;

      -- 3. Compute commitment level compatibility
      v_commit_compat := 1.0;
      IF match_row.lvl_a IS NOT NULL AND match_row.lvl_b IS NOT NULL THEN
        SELECT compat INTO v_commit_compat 
        FROM commitment_compat_matrix 
        WHERE level_a = match_row.lvl_a AND level_b = match_row.lvl_b;
        
        IF v_commit_compat IS NULL THEN
          v_commit_compat := 1.0;
        END IF;
      END IF;

      -- 4. Calculate final blend score
      v_blend_score := (sim * w_embedding) + (avg_skill_comp * w_skill) + (v_commit_compat * w_commit);

      UPDATE matches
      SET similarity_score = sim,
          final_score      = ROUND(v_blend_score::numeric, 4),
          explanation      = COALESCE(explanation, 'Similar project interests.'),
          is_stale         = false,
          computed_at      = now(),
          embedding_sim    = sim,
          skill_complement = avg_skill_comp,
          commitment_compat = v_commit_compat,
          blend_score      = v_blend_score,
          score_version    = v_score_version
      WHERE id = match_row.id;
      
      updated_count := updated_count + 1;
    END IF;
  END LOOP;

  RETURN updated_count;
END;
$$;
        """)

        # Clean existing mock data
        print("Clearing old mock seed data (email ending in @mock.connect.app)...")
        # Cascade will delete ideas, skills, embeddings, and matches
        await conn.execute("DELETE FROM users WHERE email LIKE '%@mock.connect.app'")
        
        # Loop through and insert mock builders
        for b in mock_builders:
            user_id = uuid.uuid4()
            print(f"\nSeeding user: {b['name']} ({b['email']})")
            
            # Insert User
            await conn.execute(
                """
                INSERT INTO users (id, name, email, github_url, team_size_preference, working_style, has_existing_team)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                user_id, b["name"], b["email"], b["github_url"], b["team_size_preference"], b["working_style"], b["has_existing_team"]
            )
            
            # Insert User Skills
            for skill in b["skills"]:
                await conn.execute(
                    """
                    INSERT INTO user_skills (user_id, skill_name, level, verified)
                    VALUES ($1, $2, $3, true)
                    """,
                    user_id, skill["skill_name"], skill["level"]
                )
                
            # Insert Project Idea
            idea_id = uuid.uuid4()
            idea = b["idea"]
            
            # Build canonical text
            canonical_text = f"Project: {idea['title']}. Problem: {idea['problem']} Solution: {idea['solution_idea']} Approach: {idea['approach']}"
            
            await conn.execute(
                """
                INSERT INTO project_ideas (id, user_id, problem, solution_idea, approach, tags, commitment_hrs, duration_weeks, is_active, canonical_text, embedding_stale, commitment_level, required_skills)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, true, $10, $11)
                """,
                idea_id, user_id, idea["problem"], idea["solution_idea"], idea["approach"], idea["tags"], idea["commitment_hrs"], idea["duration_weeks"], canonical_text, idea["commitment_level"], idea["required_skills"]
            )
            
            # Fetch embedding from Cohere
            embedding = await generate_embedding(canonical_text)
            
            # Call process_embedding to store the embedding
            embedding_str = f"[{','.join(map(str, embedding))}]"
            await conn.execute(
                f"SELECT process_embedding($1, '{embedding_str}'::vector, 'embed-english-v3.0')",
                idea_id
            )
            print(f"Seeded embedding for: {idea['title']}")

        # Trigger matching pipeline functions in DB
        print("\nRunning matching engine pipeline in the database...")
        new_matches = await conn.fetchval("SELECT discover_new_matches()")
        print(f"Discovered new matches: {new_matches}")
        
        stale_updated = await conn.fetchval("SELECT update_stale_matches(100)")
        print(f"Scored and updated matches: {stale_updated}")
        
        print("\nSeeding completed successfully!")
        
    except Exception as e:
        print("Error during seeding:", e)
    finally:
        # Always re-enable RLS
        print("Re-enabling Row Level Security...")
        for table in rls_tables:
            try:
                await conn.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
            except Exception as rls_err:
                print(f"Failed to enable RLS on {table}: {rls_err}")
        await conn.close()

if __name__ == "__main__":
    asyncio.run(seed())
