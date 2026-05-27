ALTER TABLE matches DROP CONSTRAINT matches_idea_a_id_fkey;
ALTER TABLE matches ADD CONSTRAINT matches_idea_a_id_fkey FOREIGN KEY (idea_a_id) REFERENCES project_ideas(id) ON DELETE CASCADE;

ALTER TABLE matches DROP CONSTRAINT matches_idea_b_id_fkey;
ALTER TABLE matches ADD CONSTRAINT matches_idea_b_id_fkey FOREIGN KEY (idea_b_id) REFERENCES project_ideas(id) ON DELETE CASCADE;

ALTER TABLE match_feedback DROP CONSTRAINT match_feedback_match_id_fkey;
ALTER TABLE match_feedback ADD CONSTRAINT match_feedback_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE;

ALTER TABLE match_feedback DROP CONSTRAINT match_feedback_actor_user_id_fkey;
ALTER TABLE match_feedback ADD CONSTRAINT match_feedback_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE peer_ratings DROP CONSTRAINT peer_ratings_rated_user_id_fkey;
ALTER TABLE peer_ratings ADD CONSTRAINT peer_ratings_rated_user_id_fkey FOREIGN KEY (rated_user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE peer_ratings DROP CONSTRAINT peer_ratings_rater_user_id_fkey;
ALTER TABLE peer_ratings ADD CONSTRAINT peer_ratings_rater_user_id_fkey FOREIGN KEY (rater_user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE peer_ratings DROP CONSTRAINT peer_ratings_team_id_fkey;
ALTER TABLE peer_ratings ADD CONSTRAINT peer_ratings_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
