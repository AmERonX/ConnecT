-- Teammate Matching Upgrades - Scoring Logic

-- 1. Create skill_complement_score function
CREATE OR REPLACE FUNCTION skill_complement_score(
  idea_skills text[],
  user_skills text[]
)
RETURNS float
LANGUAGE plpgsql
AS $$
DECLARE
  intersection_size int;
  union_size int;
BEGIN
  IF idea_skills IS NULL OR array_length(idea_skills, 1) IS NULL OR array_length(idea_skills, 1) = 0 THEN
    RETURN 1.0; -- No skills required, perfect match
  END IF;
  
  IF user_skills IS NULL OR array_length(user_skills, 1) IS NULL OR array_length(user_skills, 1) = 0 THEN
    RETURN 0.0; -- Skills required but user has none
  END IF;

  -- Intersection: common elements
  SELECT COUNT(DISTINCT x) INTO intersection_size
  FROM (
    SELECT UNNEST(idea_skills) AS x
    INTERSECT
    SELECT UNNEST(user_skills) AS x
  ) t;

  -- Union: all elements
  SELECT COUNT(DISTINCT x) INTO union_size
  FROM (
    SELECT UNNEST(idea_skills) AS x
    UNION
    SELECT UNNEST(user_skills) AS x
  ) t;

  IF union_size = 0 THEN
    RETURN 0.0;
  END IF;

  RETURN intersection_size::float / union_size::float;
END;
$$;

-- 2. Update discover_new_matches function
CREATE OR REPLACE FUNCTION discover_new_matches()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  new_count INT := 0;
  idea_row RECORD;
  neighbour RECORD;
  a_id UUID;
  b_id UUID;
  new_match_id UUID;
  pi_a_hrs INT;
  pi_b_hrs INT;
  pi_a_level TEXT;
  pi_b_level TEXT;
  v_compat FLOAT;
BEGIN
  FOR idea_row IN
    SELECT ie.idea_id, pi.user_id
    FROM idea_embeddings ie
    JOIN project_ideas pi ON pi.id = ie.idea_id
    WHERE pi.embedding_stale = false
      AND pi.canonical_text IS NOT NULL
      AND ie.embedded_at > now() - interval '2 minutes'
      AND ie.embedding_type = 'full'
  LOOP
    FOR neighbour IN
      SELECT ie2.idea_id,
             1 - (ie1.embedding <=> ie2.embedding) AS similarity
      FROM idea_embeddings ie1
      CROSS JOIN idea_embeddings ie2
      JOIN project_ideas pi2 ON pi2.id = ie2.idea_id
      WHERE ie1.idea_id = idea_row.idea_id
        AND ie2.idea_id != idea_row.idea_id
        AND pi2.user_id != idea_row.user_id
        AND ie1.embedding_type = 'full'
        AND ie2.embedding_type = 'full'
      ORDER BY ie1.embedding <=> ie2.embedding
      LIMIT 50
    LOOP
      IF idea_row.idea_id < neighbour.idea_id THEN
        a_id := idea_row.idea_id;
        b_id := neighbour.idea_id;
      ELSE
        a_id := neighbour.idea_id;
        b_id := idea_row.idea_id;
      END IF;

      -- Fetch details for hard filtering
      SELECT commitment_hrs, commitment_level INTO pi_a_hrs, pi_a_level FROM project_ideas WHERE id = a_id;
      SELECT commitment_hrs, commitment_level INTO pi_b_hrs, pi_b_level FROM project_ideas WHERE id = b_id;

      -- Hard Filter 1: Commitment Hours Delta (±5 hours)
      IF pi_a_hrs IS NOT NULL AND pi_b_hrs IS NOT NULL AND ABS(pi_a_hrs - pi_b_hrs) > 5 THEN
        CONTINUE;
      END IF;

      -- Hard Filter 2: Commitment Level Compatibility Matrix (< 0.1)
      IF pi_a_level IS NOT NULL AND pi_b_level IS NOT NULL THEN
        SELECT compat INTO v_compat FROM commitment_compat_matrix WHERE level_a = pi_a_level AND level_b = pi_b_level;
        IF v_compat IS NOT NULL AND v_compat < 0.1 THEN
          CONTINUE;
        END IF;
      END IF;

      new_match_id := NULL;

      INSERT INTO matches (idea_a_id, idea_b_id, is_stale)
      VALUES (a_id, b_id, true)
      ON CONFLICT DO NOTHING
      RETURNING id INTO new_match_id;

      IF new_match_id IS NOT NULL THEN
        INSERT INTO match_participants (match_id, idea_id)
        VALUES (new_match_id, a_id), (new_match_id, b_id)
        ON CONFLICT DO NOTHING;
        new_count := new_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN new_count;
END;
$$;

-- 3. Update update_stale_matches function
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
           pi_a.commitment_level as lvl_a, pi_b.commitment_level as lvl_b
    FROM matches m
    JOIN project_ideas pi_a ON pi_a.id = m.idea_a_id
    JOIN project_ideas pi_b ON pi_b.id = m.idea_b_id
    WHERE m.is_stale = true
    LIMIT batch_limit
    FOR UPDATE SKIP LOCKED
  LOOP
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
