CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id                      UUID PRIMARY KEY,
    name                    TEXT NOT NULL,
    email                   TEXT UNIQUE NOT NULL,
    github_url              TEXT,
    team_size_preference    INT,
    working_style           TEXT CHECK (working_style IN ('async', 'sync', 'flexible')),
    has_existing_team       BOOLEAN DEFAULT false,
    created_at              TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE project_ideas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem             TEXT NOT NULL,
    solution_idea       TEXT,
    approach            TEXT,
    tags                TEXT[],
    commitment_hrs      INT,
    duration_weeks      INT,
    is_active           BOOLEAN DEFAULT true,
    canonical_text      TEXT,
    embedding_stale     BOOLEAN DEFAULT true,
    commitment_level    TEXT CHECK (commitment_level IN ('casual', 'serious', 'portfolio', 'startup_seed')),
    required_skills     TEXT[] DEFAULT '{}',
    refresh_count       INT DEFAULT 0,
    last_refresh_window TIMESTAMPTZ DEFAULT now(),
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON project_ideas
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE idea_embeddings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id         UUID NOT NULL REFERENCES project_ideas(id) ON DELETE CASCADE,
    embedding_type  TEXT NOT NULL DEFAULT 'full',
    embedding       vector(1024) NOT NULL,
    model_version   TEXT NOT NULL,
    embedded_at     TIMESTAMPTZ DEFAULT now(),
    UNIQUE (idea_id, embedding_type)
);

CREATE INDEX idx_idea_embeddings_hnsw
ON idea_embeddings
USING hnsw (embedding vector_cosine_ops);

CREATE TABLE user_skills (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_name  TEXT NOT NULL,
    level       TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
    verified    BOOLEAN DEFAULT false
);

CREATE TABLE past_projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT,
    description     TEXT,
    verified        BOOLEAN DEFAULT false,
    completed_at    DATE
);

CREATE TABLE teams (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT,
    formed_at   TIMESTAMPTZ DEFAULT now(),
    completed   BOOLEAN DEFAULT false
);

ALTER TABLE project_ideas ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

CREATE TABLE team_members (
    team_id         UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    marked_complete BOOLEAN DEFAULT false,
    is_leader       BOOLEAN DEFAULT false,
    PRIMARY KEY (team_id, user_id)
);

CREATE TABLE peer_ratings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rated_user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rater_user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id             UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    reliability         INT CHECK (reliability BETWEEN 1 AND 5),
    communication       INT CHECK (communication BETWEEN 1 AND 5),
    contribution        INT CHECK (contribution BETWEEN 1 AND 5),
    overall_score       INT CHECK (overall_score BETWEEN 1 AND 5),
    created_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE (rated_user_id, rater_user_id, team_id)
);

CREATE TABLE matches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_a_id           UUID NOT NULL REFERENCES project_ideas(id) ON DELETE CASCADE,
    idea_b_id           UUID NOT NULL REFERENCES project_ideas(id) ON DELETE CASCADE,
    similarity_score    FLOAT,
    final_score         FLOAT,
    explanation         TEXT,
    is_stale            BOOLEAN DEFAULT true,
    computed_at         TIMESTAMPTZ DEFAULT now(),
    embedding_sim       FLOAT,
    skill_complement    FLOAT,
    commitment_compat   FLOAT,
    blend_score         FLOAT,
    score_version       INT DEFAULT 1,
    CHECK (idea_a_id < idea_b_id)
);

CREATE UNIQUE INDEX unique_match_pair
ON matches (LEAST(idea_a_id, idea_b_id), GREATEST(idea_a_id, idea_b_id));

CREATE TABLE match_participants (
    match_id    UUID REFERENCES matches(id) ON DELETE CASCADE,
    idea_id     UUID REFERENCES project_ideas(id) ON DELETE CASCADE,
    PRIMARY KEY (match_id, idea_id)
);

CREATE TABLE match_feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    actor_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal          TEXT CHECK (signal IN (
                        'connection_sent',
                        'connection_accepted',
                        'profile_viewed',
                        'dismissed'
                    )),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE match_config (
    key TEXT PRIMARY KEY,
    value FLOAT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Populate match_config defaults
INSERT INTO match_config (key, value) VALUES
('weight_embedding', 0.5),
('weight_skill', 0.3),
('weight_commit', 0.2),
('score_version', 1.0),
('hard_filter_threshold', 0.1);

CREATE TABLE commitment_compat_matrix (
    level_a TEXT NOT NULL CHECK (level_a IN ('casual', 'serious', 'portfolio', 'startup_seed')),
    level_b TEXT NOT NULL CHECK (level_b IN ('casual', 'serious', 'portfolio', 'startup_seed')),
    compat FLOAT NOT NULL,
    PRIMARY KEY (level_a, level_b)
);

-- Populate commitment_compat_matrix
INSERT INTO commitment_compat_matrix (level_a, level_b, compat) VALUES
('casual', 'casual', 1.0),
('casual', 'serious', 0.3),
('casual', 'portfolio', 0.8),
('casual', 'startup_seed', 0.0),
('serious', 'casual', 0.3),
('serious', 'serious', 1.0),
('serious', 'portfolio', 0.6),
('serious', 'startup_seed', 0.7),
('portfolio', 'casual', 0.8),
('portfolio', 'serious', 0.6),
('portfolio', 'portfolio', 1.0),
('portfolio', 'startup_seed', 0.3),
('startup_seed', 'casual', 0.0),
('startup_seed', 'serious', 0.7),
('startup_seed', 'portfolio', 0.3),
('startup_seed', 'startup_seed', 1.0);

CREATE TABLE match_rationales (
    match_id UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
    rationale_text TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT now(),
    model_used TEXT NOT NULL
);

CREATE INDEX idx_project_ideas_user_id
ON project_ideas (user_id);

CREATE INDEX idx_stale_embeddings
ON project_ideas (id)
WHERE embedding_stale = true;

CREATE INDEX idx_stale_matches
ON matches (id)
WHERE is_stale = true;

CREATE INDEX idx_match_participants_idea_id
ON match_participants (idea_id);

CREATE OR REPLACE VIEW public_profiles AS
SELECT
    id,
    name,
    github_url,
    has_existing_team,
    team_size_preference,
    working_style
FROM users;

CREATE OR REPLACE VIEW public_user_skills AS
SELECT
    user_id,
    skill_name,
    level,
    verified
FROM user_skills;

CREATE OR REPLACE VIEW public_past_projects AS
SELECT
    user_id,
    title,
    description,
    verified,
    completed_at
FROM past_projects;

REVOKE ALL ON TABLE public_profiles FROM PUBLIC;
REVOKE ALL ON TABLE public_profiles FROM anon;
REVOKE ALL ON TABLE public_profiles FROM authenticated;
GRANT SELECT ON TABLE public_profiles TO authenticated;

REVOKE ALL ON TABLE public_user_skills FROM PUBLIC;
REVOKE ALL ON TABLE public_user_skills FROM anon;
REVOKE ALL ON TABLE public_user_skills FROM authenticated;
GRANT SELECT ON TABLE public_user_skills TO authenticated;

REVOKE ALL ON TABLE public_past_projects FROM PUBLIC;
REVOKE ALL ON TABLE public_past_projects FROM anon;
REVOKE ALL ON TABLE public_past_projects FROM authenticated;
GRANT SELECT ON TABLE public_past_projects TO authenticated;

ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_ideas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE idea_embeddings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skills        ENABLE ROW LEVEL SECURITY;
ALTER TABLE past_projects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_ratings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_feedback     ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitment_compat_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_rationales   ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_team_member(team_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM team_members tm
        WHERE tm.team_id = team_uuid
          AND tm.user_id = auth.uid()
    );
$$;

CREATE POLICY "users: read own"
ON users FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "users: update own"
ON users FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "users: insert own"
ON users FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "users: delete own"
ON users FOR DELETE TO authenticated
USING (id = auth.uid());

CREATE POLICY "ideas: read active"
ON project_ideas FOR SELECT TO authenticated
USING (is_active = true);

CREATE POLICY "ideas: insert own"
ON project_ideas FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "ideas: update own or team"
ON project_ideas FOR UPDATE TO authenticated
USING (
    user_id = auth.uid() OR
    (team_id IS NOT NULL AND is_team_member(team_id))
)
WITH CHECK (
    user_id = auth.uid() OR
    (team_id IS NOT NULL AND is_team_member(team_id))
);

CREATE POLICY "ideas: delete own or team"
ON project_ideas FOR DELETE TO authenticated
USING (
    user_id = auth.uid() OR
    (team_id IS NOT NULL AND is_team_member(team_id))
);

CREATE POLICY "skills: read own"
ON user_skills FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "skills: insert own"
ON user_skills FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "skills: update own"
ON user_skills FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "skills: delete own"
ON user_skills FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "past_projects: read own"
ON past_projects FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "past_projects: insert own"
ON past_projects FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "past_projects: update own"
ON past_projects FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "past_projects: delete own"
ON past_projects FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "matches: participants can read"
ON matches FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM match_participants mp
        JOIN project_ideas pi ON pi.id = mp.idea_id
        WHERE mp.match_id = matches.id
          AND pi.user_id = auth.uid()
    )
);

CREATE POLICY "match_participants: participants can read"
ON match_participants FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM project_ideas pi
        WHERE pi.id = match_participants.idea_id
          AND pi.user_id = auth.uid()
    )
);

CREATE POLICY "feedback: insert as self"
ON match_feedback FOR INSERT TO authenticated
WITH CHECK (actor_user_id = auth.uid());

CREATE POLICY "feedback: participants can read"
ON match_feedback FOR SELECT TO authenticated
USING (
    actor_user_id = auth.uid() OR
    EXISTS (
        SELECT 1
        FROM match_participants mp
        JOIN project_ideas pi ON pi.id = mp.idea_id
        WHERE mp.match_id = match_feedback.match_id
          AND pi.user_id = auth.uid()
    )
);

CREATE POLICY "match_config: authenticated can read"
ON match_config FOR SELECT TO authenticated
USING (true);

CREATE POLICY "commitment_compat_matrix: authenticated can read"
ON commitment_compat_matrix FOR SELECT TO authenticated
USING (true);

CREATE POLICY "rationales: participants can read"
ON match_rationales FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM match_participants mp
        JOIN project_ideas pi ON pi.id = mp.idea_id
        WHERE mp.match_id = match_rationales.match_id
          AND pi.user_id = auth.uid()
    )
);

CREATE POLICY "ratings: read own"
ON peer_ratings FOR SELECT TO authenticated
USING (
    rated_user_id = auth.uid() OR
    rater_user_id = auth.uid()
);

CREATE POLICY "ratings: insert as self"
ON peer_ratings FOR INSERT TO authenticated
WITH CHECK (rater_user_id = auth.uid());

CREATE POLICY "teams: members can read"
ON teams FOR SELECT TO authenticated
USING (is_team_member(teams.id));

CREATE POLICY "teams: members can update"
ON teams FOR UPDATE TO authenticated
USING (is_team_member(teams.id))
WITH CHECK (is_team_member(teams.id));

CREATE POLICY "team_members: members can read"
ON team_members FOR SELECT TO authenticated
USING (is_team_member(team_members.team_id));

CREATE POLICY "team_members: members can update"
ON team_members FOR UPDATE TO authenticated
USING (is_team_member(team_members.team_id))
WITH CHECK (is_team_member(team_members.team_id));

CREATE POLICY "team_members: members can delete"
ON team_members FOR DELETE TO authenticated
USING (is_team_member(team_members.team_id));

CREATE OR REPLACE FUNCTION claim_stale_ideas(batch_limit INT DEFAULT 10)
RETURNS SETOF project_ideas
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM project_ideas
  WHERE embedding_stale = true
    AND canonical_text IS NOT NULL
    AND is_active = true
  LIMIT batch_limit
  FOR UPDATE SKIP LOCKED;
END;
$$;

CREATE OR REPLACE FUNCTION process_embedding(
  p_idea_id UUID,
  p_embedding vector(1024),
  p_model_version TEXT
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO idea_embeddings (idea_id, embedding_type, embedding, model_version)
  VALUES (p_idea_id, 'full', p_embedding, p_model_version)
  ON CONFLICT (idea_id, embedding_type)
  DO UPDATE SET
    embedding     = EXCLUDED.embedding,
    model_version = EXCLUDED.model_version,
    embedded_at   = now();

  UPDATE matches SET is_stale = true
  WHERE id IN (
    SELECT match_id FROM match_participants WHERE idea_id = p_idea_id
  );

  UPDATE project_ideas
  SET embedding_stale = false, updated_at = now()
  WHERE id = p_idea_id;
END;
$$;

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
  
  level_a text;
  level_b text;
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
      AND pi.is_active = true
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
        AND pi2.is_active = true
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
