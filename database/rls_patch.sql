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

DROP POLICY IF EXISTS "users: read own" ON users;
DROP POLICY IF EXISTS "users: authenticated can read" ON users;
CREATE POLICY "users: read own"
ON users FOR SELECT TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "users: insert own" ON users;
CREATE POLICY "users: insert own"
ON users FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users: update own" ON users;
CREATE POLICY "users: update own"
ON users FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users: delete own" ON users;
CREATE POLICY "users: delete own"
ON users FOR DELETE TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "skills: read own" ON user_skills;
DROP POLICY IF EXISTS "skills: read any" ON user_skills;
CREATE POLICY "skills: read own"
ON user_skills FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "skills: insert own" ON user_skills;
CREATE POLICY "skills: insert own"
ON user_skills FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "skills: update own" ON user_skills;
CREATE POLICY "skills: update own"
ON user_skills FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "skills: delete own" ON user_skills;
CREATE POLICY "skills: delete own"
ON user_skills FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "past_projects: read own" ON past_projects;
DROP POLICY IF EXISTS "past_projects: read any" ON past_projects;
CREATE POLICY "past_projects: read own"
ON past_projects FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "past_projects: insert own" ON past_projects;
DROP POLICY IF EXISTS "past_projects: manage own" ON past_projects;
CREATE POLICY "past_projects: insert own"
ON past_projects FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "past_projects: update own" ON past_projects;
CREATE POLICY "past_projects: update own"
ON past_projects FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "past_projects: delete own" ON past_projects;
CREATE POLICY "past_projects: delete own"
ON past_projects FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "feedback: read own" ON match_feedback;
DROP POLICY IF EXISTS "feedback: participants can read" ON match_feedback;
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

DROP POLICY IF EXISTS "teams: members can read" ON teams;
CREATE POLICY "teams: members can read"
ON teams FOR SELECT TO authenticated
USING (is_team_member(teams.id));

DROP POLICY IF EXISTS "team_members: members can read" ON team_members;
CREATE POLICY "team_members: members can read"
ON team_members FOR SELECT TO authenticated
USING (is_team_member(team_members.team_id));
