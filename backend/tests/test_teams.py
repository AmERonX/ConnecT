import pytest
from httpx import AsyncClient
import uuid

from app.main import app
from app.db import db, fetch_dict, fetchrow_dict

@pytest.fixture
async def clear_db():
    async with db.service_connection() as conn:
        await conn.execute("DELETE FROM match_feedback")
        await conn.execute("DELETE FROM match_participants")
        await conn.execute("DELETE FROM matches")
        await conn.execute("DELETE FROM team_members")
        await conn.execute("DELETE FROM teams")
        await conn.execute("DELETE FROM project_ideas")
        await conn.execute("DELETE FROM users")

@pytest.mark.anyio
async def test_team_consolidation_logic(clear_db, monkeypatch):
    user_a_id = str(uuid.uuid4())
    user_b_id = str(uuid.uuid4())
    user_c_id = str(uuid.uuid4())
    
    async def mock_auth_dep(request):
        # We'll use monkeypatch later to swap this, or just pass a custom header if auth is mocked
        pass

    async with db.service_connection() as conn:
        # Create users
        await conn.execute("INSERT INTO users (id, name, email) VALUES ($1, 'User A', 'a@example.com')", user_a_id)
        await conn.execute("INSERT INTO users (id, name, email) VALUES ($1, 'User B', 'b@example.com')", user_b_id)
        await conn.execute("INSERT INTO users (id, name, email) VALUES ($1, 'User C', 'c@example.com')", user_c_id)
        
        # Create ideas
        idea_a_id = await conn.fetchval("INSERT INTO project_ideas (user_id, problem) VALUES ($1, 'Problem A') RETURNING id", user_a_id)
        idea_b_id = await conn.fetchval("INSERT INTO project_ideas (user_id, problem) VALUES ($1, 'Problem B') RETURNING id", user_b_id)
        idea_c_id = await conn.fetchval("INSERT INTO project_ideas (user_id, problem) VALUES ($1, 'Problem C') RETURNING id", user_c_id)
        
        # Create match A-B
        # UUIDs are random, so we must sort them to satisfy CHECK (idea_a_id < idea_b_id)
        idea_a_id_sorted, idea_b_id_sorted = sorted([idea_a_id, idea_b_id])
        match_ab_id = await conn.fetchval(
            "INSERT INTO matches (idea_a_id, idea_b_id, final_score) VALUES ($1, $2, 0.9) RETURNING id",
            idea_a_id_sorted, idea_b_id_sorted
        )
        await conn.execute("INSERT INTO match_participants (match_id, idea_id) VALUES ($1, $2)", match_ab_id, idea_a_id)
        await conn.execute("INSERT INTO match_participants (match_id, idea_id) VALUES ($1, $2)", match_ab_id, idea_b_id)

    # Monkeypatch get_auth_context to simulate different users
    from app.auth import AuthContext
    from httpx import ASGITransport

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. User A sends connection request to User B
        app.dependency_overrides[app.router.dependencies[0].dependency if app.router.dependencies else "get_auth_context"] = lambda: AuthContext(user_id=user_a_id, email="a@example.com", token="dummy")
        
        # We need a proper way to override get_auth_context. Let's just override it on the routes
        from app.auth import get_auth_context
        
        app.dependency_overrides[get_auth_context] = lambda: AuthContext(user_id=user_a_id, email="a@example.com", token="dummy")
        resp = await client.post("/feedback", json={"match_id": str(match_ab_id), "signal": "connection_sent"})
        assert resp.status_code == 201

        # 2. User B accepts connection request from User A
        app.dependency_overrides[get_auth_context] = lambda: AuthContext(user_id=user_b_id, email="b@example.com", token="dummy")
        resp = await client.post("/feedback", json={"match_id": str(match_ab_id), "signal": "connection_accepted"})
        assert resp.status_code == 201

        # 3. User B creates a team from the match
        resp = await client.post("/teams", json={"match_id": str(match_ab_id), "name": "Team AB"})
        assert resp.status_code == 201
        
        team_data = resp.json()["data"]
        team_id = team_data["id"]
        
        # Check database states
        async with db.service_connection() as conn:
            idea_a = await fetchrow_dict(conn, "SELECT is_active, team_id FROM project_ideas WHERE id = $1", idea_a_id)
            idea_b = await fetchrow_dict(conn, "SELECT is_active, team_id FROM project_ideas WHERE id = $1", idea_b_id)
            
            # User A sent the request, so their idea is promoted to Team Idea
            assert idea_a["team_id"] == uuid.UUID(team_id)
            assert idea_a["is_active"] is True
            
            # User B's idea is deactivated and has no team_id
            assert idea_b["team_id"] is None
            assert idea_b["is_active"] is False

        # --- Test joining an existing team ---
        async with db.service_connection() as conn:
            # Create match A-C (A is now a Team Idea)
            idea_a_id_sorted, idea_c_id_sorted = sorted([idea_a_id, idea_c_id])
            match_ac_id = await conn.fetchval(
                "INSERT INTO matches (idea_a_id, idea_b_id, final_score) VALUES ($1, $2, 0.8) RETURNING id",
                idea_a_id_sorted, idea_c_id_sorted
            )
            await conn.execute("INSERT INTO match_participants (match_id, idea_id) VALUES ($1, $2)", match_ac_id, idea_a_id)
            await conn.execute("INSERT INTO match_participants (match_id, idea_id) VALUES ($1, $2)", match_ac_id, idea_c_id)

        # 4. User C sends connection request to Team A
        app.dependency_overrides[get_auth_context] = lambda: AuthContext(user_id=user_c_id, email="c@example.com", token="dummy")
        resp = await client.post("/feedback", json={"match_id": str(match_ac_id), "signal": "connection_sent"})
        assert resp.status_code == 201

        # 5. User A accepts connection request from User C
        app.dependency_overrides[get_auth_context] = lambda: AuthContext(user_id=user_a_id, email="a@example.com", token="dummy")
        resp = await client.post("/feedback", json={"match_id": str(match_ac_id), "signal": "connection_accepted"})
        assert resp.status_code == 201

        # 6. User A forms the team (adds C to existing team)
        resp = await client.post("/teams", json={"match_id": str(match_ac_id), "name": "Should ignore name"})
        assert resp.status_code == 201
        
        # Check database states again
        async with db.service_connection() as conn:
            idea_a = await fetchrow_dict(conn, "SELECT is_active, team_id FROM project_ideas WHERE id = $1", idea_a_id)
            idea_c = await fetchrow_dict(conn, "SELECT is_active, team_id FROM project_ideas WHERE id = $1", idea_c_id)
            
            # Idea A remains the Team Idea
            assert idea_a["team_id"] == uuid.UUID(team_id)
            assert idea_a["is_active"] is True
            
            # User C's idea is deactivated and has no team_id
            assert idea_c["team_id"] is None
            assert idea_c["is_active"] is False
            
            # Verify team members (A, B, C)
            members = await conn.fetch("SELECT user_id FROM team_members WHERE team_id = $1", uuid.UUID(team_id))
            member_ids = {str(m["user_id"]) for m in members}
            assert member_ids == {user_a_id, user_b_id, user_c_id}

    app.dependency_overrides.clear()
