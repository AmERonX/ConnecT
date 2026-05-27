from fastapi import APIRouter, Depends

from app.auth import AuthContext, get_auth_context
from app.db import db, fetch_dict, fetchrow_dict
from app.errors import AppError
from app.models.team import TeamCreateRequest, TeamUpdateRequest, PeerRatingRequest, TeamMemberCompleteRequest
from app.responses import success_response

router = APIRouter(tags=["teams"])


async def _team_with_members(conn, team_id: str) -> dict:
    team = await fetchrow_dict(
        conn,
        """
        SELECT id, name, formed_at, completed
        FROM teams
        WHERE id = $1
        """,
        team_id,
    )
    if not team:
        raise AppError(code="NOT_FOUND", message="Team not found.", status_code=404)

    members = await fetch_dict(
        conn,
        """
        SELECT p.id, p.name, tm.marked_complete, tm.is_leader,
               EXISTS (
                   SELECT 1 FROM peer_ratings pr
                   WHERE pr.team_id = tm.team_id
                     AND pr.rater_user_id = auth.uid()
                     AND pr.rated_user_id = p.id
               ) AS rated_by_me
        FROM team_members tm
        JOIN public_profiles p ON p.id = tm.user_id
        WHERE tm.team_id = $1
        ORDER BY p.name ASC
        """,
        team_id,
    )

    idea = await fetchrow_dict(
        conn,
        """
        SELECT id, title, problem, solution_idea
        FROM project_ideas
        WHERE team_id = $1
        LIMIT 1
        """,
        team_id,
    )

    return {
        "id": str(team["id"]),
        "name": team.get("name"),
        "formed_at": team["formed_at"].isoformat(),
        "completed": bool(team["completed"]),
        "members": [{"id": str(member["id"]), "name": member["name"], "marked_complete": bool(member["marked_complete"]), "is_leader": bool(member["is_leader"]), "rated_by_me": bool(member.get("rated_by_me", False))} for member in members],
        "idea": {
            "id": str(idea["id"]),
            "title": idea["title"],
            "problem": idea["problem"],
            "solution_idea": idea["solution_idea"],
        } if idea else None
    }


@router.post("/teams")
async def create_team(body: TeamCreateRequest, auth: AuthContext = Depends(get_auth_context)):
    async with db.service_connection() as conn:
        participants = await fetch_dict(
            conn,
            """
            SELECT pi.id, pi.user_id, pi.team_id
            FROM match_participants mp
            JOIN project_ideas pi ON pi.id = mp.idea_id
            WHERE mp.match_id = $1
            """,
            body.match_id,
        )

        if not participants:
            raise AppError(code="NOT_FOUND", message="Match not found.", status_code=404)

        accepted = await fetchrow_dict(
            conn,
            """
            SELECT 1 AS ok
            FROM match_feedback
            WHERE match_id = $1
              AND signal = 'connection_accepted'
            LIMIT 1
            """,
            body.match_id,
        )
        if not accepted:
            raise AppError(code="CONFLICT", message="The match has not been accepted yet.", status_code=409)

        user_ids = sorted({str(item["user_id"]) for item in participants})
        if auth.user_id not in user_ids:
            raise AppError(code="FORBIDDEN", message="You are not a participant in this match.", status_code=403)

        sender_feedback = await fetchrow_dict(
            conn,
            """
            SELECT actor_user_id
            FROM match_feedback
            WHERE match_id = $1 AND signal = 'connection_sent'
            ORDER BY created_at ASC
            LIMIT 1
            """,
            body.match_id
        )
        if not sender_feedback:
            raise AppError(code="CONFLICT", message="No connection request found for this match.", status_code=409)

        sender_user_id = str(sender_feedback["actor_user_id"])
        
        sender_idea = next((p for p in participants if str(p["user_id"]) == sender_user_id), None)
        receiver_idea = next((p for p in participants if str(p["user_id"]) != sender_user_id), None)

        if not sender_idea or not receiver_idea:
            raise AppError(code="NOT_FOUND", message="Could not identify sender and receiver ideas.", status_code=404)

        team_idea = next((p for p in participants if p["team_id"] is not None), None)

        async with conn.transaction():
            if team_idea:
                team_id = team_idea["team_id"]
                new_user_idea = receiver_idea if team_idea["id"] == sender_idea["id"] else sender_idea
                
                await conn.execute(
                    """
                    INSERT INTO team_members (team_id, user_id)
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                    """,
                    team_id,
                    new_user_idea["user_id"],
                )
                
                await conn.execute(
                    """
                    UPDATE project_ideas
                    SET is_active = false
                    WHERE id = $1
                    """,
                    new_user_idea["id"],
                )
                
                await conn.execute(
                    """
                    UPDATE teams
                    SET completed = false
                    WHERE id = $1
                    """,
                    team_id,
                )
                
                await conn.execute(
                    """
                    UPDATE project_ideas
                    SET is_active = true
                    WHERE team_id = $1
                    """,
                    team_id,
                )
                
                team_row = {"id": team_id}
            else:
                team_row = await fetchrow_dict(
                    conn,
                    """
                    INSERT INTO teams (name)
                    VALUES ($1)
                    RETURNING id
                    """,
                    body.name,
                )

                for user_id in user_ids:
                    is_leader = (user_id == sender_user_id)
                    await conn.execute(
                        """
                        INSERT INTO team_members (team_id, user_id, is_leader)
                        VALUES ($1, $2, $3)
                        ON CONFLICT DO NOTHING
                        """,
                        team_row["id"],
                        user_id,
                        is_leader,
                    )
                
                await conn.execute(
                    """
                    UPDATE project_ideas
                    SET team_id = $1
                    WHERE id = $2
                    """,
                    team_row["id"],
                    sender_idea["id"],
                )

                await conn.execute(
                    """
                    UPDATE project_ideas
                    SET is_active = false
                    WHERE id = $1
                    """,
                    receiver_idea["id"],
                )

    async with db.connection(auth.user_id) as conn:
        team = await _team_with_members(conn, str(team_row["id"]))

    return success_response(team, status_code=201)


@router.get("/teams")
async def list_teams(auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        teams = await fetch_dict(
            conn,
            """
            SELECT t.id
            FROM teams t
            JOIN team_members tm ON tm.team_id = t.id
            WHERE tm.user_id = $1
            ORDER BY t.formed_at DESC
            """,
            auth.user_id,
        )

        serialized_teams = []
        for team in teams:
            serialized_teams.append(await _team_with_members(conn, str(team["id"])))

        pending_received = await fetch_dict(
            conn,
            """
            SELECT DISTINCT ON (mf.match_id)
                mf.match_id,
                mf.created_at,
                sender.id AS sender_id,
                sender.name AS sender_name,
                my_idea.id AS my_idea_id,
                my_idea.problem AS my_idea_problem
            FROM match_feedback mf
            JOIN match_participants mp_sender ON mp_sender.match_id = mf.match_id
            JOIN project_ideas sender_idea ON sender_idea.id = mp_sender.idea_id
            JOIN public_profiles sender ON sender.id = sender_idea.user_id
            JOIN match_participants mp_me ON mp_me.match_id = mf.match_id
            JOIN project_ideas my_idea ON my_idea.id = mp_me.idea_id
            WHERE mf.signal = 'connection_sent'
              AND sender.id != $1
              AND my_idea.user_id = $1
              AND sender_idea.user_id = mf.actor_user_id
              AND NOT EXISTS (
                  SELECT 1
                  FROM match_feedback mf2
                  WHERE mf2.match_id = mf.match_id
                    AND mf2.actor_user_id = $1
                    AND mf2.signal IN ('connection_accepted', 'dismissed')
              )
              AND NOT EXISTS (
                  SELECT 1
                  FROM match_feedback mf3
                  WHERE mf3.match_id = mf.match_id
                    AND mf3.signal = 'connection_accepted'
              )
            ORDER BY mf.match_id, mf.created_at DESC
            """,
            auth.user_id,
        )

        pending_sent = await fetch_dict(
            conn,
            """
            SELECT DISTINCT ON (mf.match_id)
                mf.match_id,
                mf.created_at,
                receiver.id AS receiver_id,
                receiver.name AS receiver_name
            FROM match_feedback mf
            JOIN match_participants mp_sender ON mp_sender.match_id = mf.match_id
            JOIN project_ideas sender_idea ON sender_idea.id = mp_sender.idea_id
            JOIN match_participants mp_receiver ON mp_receiver.match_id = mf.match_id
            JOIN project_ideas receiver_idea ON receiver_idea.id = mp_receiver.idea_id
            JOIN public_profiles receiver ON receiver.id = receiver_idea.user_id
            WHERE mf.signal = 'connection_sent'
              AND mf.actor_user_id = $1
              AND sender_idea.user_id = $1
              AND receiver_idea.user_id != $1
              AND NOT EXISTS (
                  SELECT 1
                  FROM match_feedback mf2
                  WHERE mf2.match_id = mf.match_id
                    AND mf2.signal IN ('connection_accepted', 'dismissed')
                    AND mf2.actor_user_id = receiver.id
              )
              AND NOT EXISTS (
                  SELECT 1
                  FROM match_feedback mf3
                  WHERE mf3.match_id = mf.match_id
                    AND mf3.signal = 'connection_accepted'
              )
            ORDER BY mf.match_id, mf.created_at DESC
            """,
            auth.user_id,
        )

    return success_response(
        {
            "teams": serialized_teams,
            "pending": {
                "received": [
                    {
                        "match_id": str(item["match_id"]),
                        "created_at": item["created_at"].isoformat(),
                        "sender": {
                            "id": str(item["sender_id"]),
                            "name": item["sender_name"],
                        },
                        "my_idea": {
                            "id": str(item["my_idea_id"]),
                            "problem": item["my_idea_problem"],
                        },
                    }
                    for item in pending_received
                ],
                "sent": [
                    {
                        "match_id": str(item["match_id"]),
                        "created_at": item["created_at"].isoformat(),
                        "receiver": {
                            "id": str(item["receiver_id"]),
                            "name": item["receiver_name"],
                        },
                    }
                    for item in pending_sent
                ],
            },
        }
    )


@router.get("/teams/{team_id}")
async def get_team(team_id: str, auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        membership = await fetchrow_dict(
            conn,
            """
            SELECT 1 AS ok
            FROM team_members
            WHERE team_id = $1 AND user_id = $2
            """,
            team_id,
            auth.user_id,
        )

        if not membership:
            exists = await fetchrow_dict(conn, "SELECT id FROM teams WHERE id = $1", team_id)
            if exists:
                raise AppError(code="FORBIDDEN", message="You are not a member of this team.", status_code=403)
            raise AppError(code="NOT_FOUND", message="Team not found.", status_code=404)

        team = await _team_with_members(conn, team_id)

    return success_response(team)


@router.patch("/teams/{team_id}")
async def update_team(team_id: str, body: TeamUpdateRequest, auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        membership = await fetchrow_dict(
            conn,
            """
            SELECT 1 AS ok
            FROM team_members
            WHERE team_id = $1 AND user_id = $2
            """,
            team_id,
            auth.user_id,
        )

        if not membership:
            exists = await fetchrow_dict(conn, "SELECT id FROM teams WHERE id = $1", team_id)
            if exists:
                raise AppError(code="FORBIDDEN", message="You are not a member of this team.", status_code=403)
            raise AppError(code="NOT_FOUND", message="Team not found.", status_code=404)

        if body.name is not None:
            await conn.execute(
                """
                UPDATE teams
                SET name = $1
                WHERE id = $2
                """,
                body.name,
                team_id,
            )

        team = await _team_with_members(conn, team_id)

    return success_response(team)


@router.patch("/teams/{team_id}/members/me/complete")
async def mark_member_complete(team_id: str, body: TeamMemberCompleteRequest, auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        membership = await fetchrow_dict(
            conn,
            """
            SELECT 1 AS ok
            FROM team_members
            WHERE team_id = $1 AND user_id = $2
            """,
            team_id,
            auth.user_id,
        )

        if not membership:
            raise AppError(code="FORBIDDEN", message="You are not a member of this team.", status_code=403)

        async with conn.transaction():
            await conn.execute(
                """
                UPDATE team_members
                SET marked_complete = $1
                WHERE team_id = $2 AND user_id = $3
                """,
                body.complete,
                team_id,
                auth.user_id,
            )

            incomplete_count = await fetchrow_dict(
                conn,
                """
                SELECT COUNT(*) as count
                FROM team_members
                WHERE team_id = $1 AND marked_complete = false
                """,
                team_id,
            )

            all_complete = incomplete_count and incomplete_count["count"] == 0

            await conn.execute(
                """
                UPDATE teams
                SET completed = $1
                WHERE id = $2
                """,
                all_complete,
                team_id,
            )
            
            await conn.execute(
                """
                UPDATE project_ideas
                SET is_active = $1
                WHERE team_id = $2
                """,
                not all_complete,
                team_id,
            )

        team = await _team_with_members(conn, team_id)

    return success_response(team)


@router.delete("/teams/{team_id}/members/me")
async def leave_team(team_id: str, auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        membership = await fetchrow_dict(
            conn,
            """
            SELECT is_leader
            FROM team_members
            WHERE team_id = $1 AND user_id = $2
            """,
            team_id,
            auth.user_id,
        )

        if not membership:
            raise AppError(code="NOT_FOUND", message="You are not in this team.", status_code=404)

        async with conn.transaction():
            await conn.execute(
                """
                DELETE FROM team_members
                WHERE team_id = $1 AND user_id = $2
                """,
                team_id,
                auth.user_id,
            )

            remaining = await fetchrow_dict(
                conn,
                """
                SELECT COUNT(*) as count
                FROM team_members
                WHERE team_id = $1
                """,
                team_id,
            )

            if remaining and remaining["count"] == 0:
                await conn.execute(
                    """
                    UPDATE project_ideas
                    SET team_id = NULL, is_active = true
                    WHERE team_id = $1
                    """,
                    team_id,
                )
                await conn.execute("DELETE FROM teams WHERE id = $1", team_id)
                
                await conn.execute(
                    """
                    UPDATE project_ideas
                    SET is_active = true
                    WHERE user_id = $1 AND team_id IS NULL AND is_active = false
                    """,
                    auth.user_id,
                )
                return success_response({"deleted": True})
            elif membership.get("is_leader"):
                next_leader = await fetchrow_dict(
                    conn,
                    """
                    SELECT user_id
                    FROM team_members
                    WHERE team_id = $1
                    LIMIT 1
                    """,
                    team_id,
                )
                if next_leader:
                    await conn.execute(
                        """
                        UPDATE team_members
                        SET is_leader = true
                        WHERE team_id = $1 AND user_id = $2
                        """,
                        team_id,
                        next_leader["user_id"],
                    )
                
            await conn.execute(
                """
                UPDATE project_ideas
                SET is_active = true
                WHERE user_id = $1 AND team_id IS NULL AND is_active = false
                """,
                auth.user_id,
            )

    return success_response({"deleted": False})


@router.delete("/teams/{team_id}/members/{target_user_id}")
async def kick_team_member(team_id: str, target_user_id: str, auth: AuthContext = Depends(get_auth_context)):
    if target_user_id == "me" or target_user_id == auth.user_id:
        raise AppError(code="BAD_REQUEST", message="Use the leave team action to remove yourself.", status_code=400)

    async with db.connection(auth.user_id) as conn:
        membership = await fetchrow_dict(
            conn,
            """
            SELECT is_leader
            FROM team_members
            WHERE team_id = $1 AND user_id = $2
            """,
            team_id,
            auth.user_id,
        )

        if not membership:
            raise AppError(code="FORBIDDEN", message="You are not in this team.", status_code=403)
            
        if not membership.get("is_leader"):
            raise AppError(code="FORBIDDEN", message="Only the team leader can kick members.", status_code=403)
            
        target_membership = await fetchrow_dict(
            conn,
            """
            SELECT 1 AS ok
            FROM team_members
            WHERE team_id = $1 AND user_id = $2
            """,
            team_id,
            target_user_id,
        )

        if not target_membership:
            raise AppError(code="NOT_FOUND", message="The user is not in this team.", status_code=404)

        async with conn.transaction():
            await conn.execute(
                """
                DELETE FROM team_members
                WHERE team_id = $1 AND user_id = $2
                """,
                team_id,
                target_user_id,
            )

            incomplete_count = await fetchrow_dict(
                conn,
                """
                SELECT COUNT(*) as count
                FROM team_members
                WHERE team_id = $1 AND marked_complete = false
                """,
                team_id,
            )

            all_complete = incomplete_count and incomplete_count["count"] == 0

            await conn.execute(
                """
                UPDATE teams
                SET completed = $1
                WHERE id = $2
                """,
                all_complete,
                team_id,
            )
            
            await conn.execute(
                """
                UPDATE project_ideas
                SET is_active = $1
                WHERE team_id = $2
                """,
                not all_complete,
                team_id,
            )

            await conn.execute(
                """
                UPDATE project_ideas
                SET is_active = true
                WHERE user_id = $1 AND team_id IS NULL AND is_active = false
                """,
                target_user_id,
            )

        team = await _team_with_members(conn, team_id)

    return success_response(team)


@router.post("/teams/{team_id}/ratings")
async def rate_peer(team_id: str, body: PeerRatingRequest, auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        membership = await fetchrow_dict(
            conn,
            """
            SELECT 1 AS ok
            FROM team_members
            WHERE team_id = $1 AND user_id = $2
            """,
            team_id,
            auth.user_id,
        )

        if not membership:
            raise AppError(code="FORBIDDEN", message="You are not a member of this team.", status_code=403)

        target_membership = await fetchrow_dict(
            conn,
            """
            SELECT 1 AS ok
            FROM team_members
            WHERE team_id = $1 AND user_id = $2
            """,
            team_id,
            body.rated_user_id,
        )

        if not target_membership:
            raise AppError(code="NOT_FOUND", message="User is not in this team.", status_code=404)
            
        team = await fetchrow_dict(conn, "SELECT completed FROM teams WHERE id = $1", team_id)
        if not team or not team["completed"]:
            raise AppError(code="BAD_REQUEST", message="You can only rate peers when the team is marked as completed.", status_code=400)

        await conn.execute(
            """
            INSERT INTO peer_ratings (
                rated_user_id, rater_user_id, team_id,
                reliability, communication, contribution, overall_score
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (rated_user_id, rater_user_id, team_id)
            DO UPDATE SET
                reliability = EXCLUDED.reliability,
                communication = EXCLUDED.communication,
                contribution = EXCLUDED.contribution,
                overall_score = EXCLUDED.overall_score
            """,
            body.rated_user_id,
            auth.user_id,
            team_id,
            body.reliability,
            body.communication,
            body.contribution,
            body.overall_score,
        )
        
        updated_team = await _team_with_members(conn, team_id)
        
    return success_response(updated_team, status_code=201)
