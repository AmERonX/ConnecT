from fastapi import APIRouter, Depends

from app.auth import AuthContext, get_auth_context
from app.db import db, fetch_dict, fetchrow_dict
from app.errors import AppError
from app.models.team import TeamCreateRequest
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
        SELECT u.id, u.name
        FROM team_members tm
        JOIN users u ON u.id = tm.user_id
        WHERE tm.team_id = $1
        ORDER BY u.name ASC
        """,
        team_id,
    )

    return {
        "id": str(team["id"]),
        "name": team.get("name"),
        "formed_at": team["formed_at"].isoformat(),
        "completed": bool(team["completed"]),
        "members": [{"id": str(member["id"]), "name": member["name"]} for member in members],
    }


@router.post("/teams")
async def create_team(body: TeamCreateRequest, auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        participants = await fetch_dict(
            conn,
            """
            SELECT pi.user_id
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

        async with conn.transaction():
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
                await conn.execute(
                    """
                    INSERT INTO team_members (team_id, user_id)
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                    """,
                    team_row["id"],
                    user_id,
                )

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
            JOIN users sender ON sender.id = sender_idea.user_id
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
            JOIN users receiver ON receiver.id = receiver_idea.user_id
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
