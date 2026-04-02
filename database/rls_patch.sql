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

DROP POLICY IF EXISTS "users: read own" ON users;
DROP POLICY IF EXISTS "users: authenticated can read" ON users;
CREATE POLICY "users: authenticated can read"
ON users FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "users: insert own" ON users;
CREATE POLICY "users: insert own"
ON users FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users: delete own" ON users;
CREATE POLICY "users: delete own"
ON users FOR DELETE TO authenticated
USING (id = auth.uid());

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
