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

CREATE TABLE team_members (
    team_id     UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, user_id)
);

CREATE TABLE peer_ratings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rated_user_id       UUID NOT NULL REFERENCES users(id),
    rater_user_id       UUID NOT NULL REFERENCES users(id),
    team_id             UUID NOT NULL REFERENCES teams(id),
    reliability         INT CHECK (reliability BETWEEN 1 AND 5),
    communication       INT CHECK (communication BETWEEN 1 AND 5),
    contribution        INT CHECK (contribution BETWEEN 1 AND 5),
    overall_score       INT CHECK (overall_score BETWEEN 1 AND 5),
    created_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE (rated_user_id, rater_user_id, team_id)
);

CREATE TABLE matches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_a_id           UUID NOT NULL REFERENCES project_ideas(id),
    idea_b_id           UUID NOT NULL REFERENCES project_ideas(id),
    similarity_score    FLOAT,
    final_score         FLOAT,
    explanation         TEXT,
    is_stale            BOOLEAN DEFAULT true,
    computed_at         TIMESTAMPTZ DEFAULT now(),
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
    match_id        UUID NOT NULL REFERENCES matches(id),
    actor_user_id   UUID NOT NULL REFERENCES users(id),
    signal          TEXT CHECK (signal IN (
                        'connection_sent',
                        'connection_accepted',
                        'profile_viewed',
                        'dismissed'
                    )),
    created_at      TIMESTAMPTZ DEFAULT now()
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

CREATE POLICY "ideas: update own"
ON project_ideas FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

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

CREATE POLICY "team_members: members can read"
ON team_members FOR SELECT TO authenticated
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

CREATE OR REPLACE FUNCTION update_stale_matches(batch_limit INT DEFAULT 50)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count INT := 0;
  match_row RECORD;
  sim FLOAT;
BEGIN
  FOR match_row IN
    SELECT id, idea_a_id, idea_b_id
    FROM matches
    WHERE is_stale = true
    LIMIT batch_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT 1 - (e1.embedding <=> e2.embedding) INTO sim
    FROM idea_embeddings e1, idea_embeddings e2
    WHERE e1.idea_id = match_row.idea_a_id
      AND e2.idea_id = match_row.idea_b_id
      AND e1.embedding_type = 'full'
      AND e2.embedding_type = 'full';

    IF sim IS NOT NULL THEN
      UPDATE matches
      SET similarity_score = sim,
          final_score      = ROUND(sim::numeric, 4),
          explanation      = COALESCE(explanation, 'Similar project interests.'),
          is_stale         = false,
          computed_at      = now()
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
