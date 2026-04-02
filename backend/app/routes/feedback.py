from fastapi import APIRouter, Depends, Query

from app.auth import AuthContext, get_auth_context
from app.db import db, fetch_dict
from app.errors import AppError
from app.models.feedback import FeedbackCreateRequest
from app.responses import success_response

router = APIRouter(tags=["feedback"])


async def _match_participants(conn, match_id: str):
    return await fetch_dict(
        conn,
        """
        SELECT pi.user_id, pi.id AS idea_id
        FROM match_participants mp
        JOIN project_ideas pi ON pi.id = mp.idea_id
        WHERE mp.match_id = $1
        """,
        match_id,
    )


@router.post("/feedback")
async def create_feedback(body: FeedbackCreateRequest, auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        participants = await _match_participants(conn, body.match_id)
        if not participants:
            raise AppError(code="NOT_FOUND", message="Match not found.", status_code=404)

        participant_user_ids = {str(item["user_id"]) for item in participants}
        if auth.user_id not in participant_user_ids:
            raise AppError(code="FORBIDDEN", message="You are not a participant in this match.", status_code=403)

        row = await conn.fetchrow(
            """
            INSERT INTO match_feedback (match_id, actor_user_id, signal)
            VALUES ($1, $2, $3)
            RETURNING id, match_id, signal, created_at
            """,
            body.match_id,
            auth.user_id,
            body.signal,
        )

    return success_response(
        {
            "id": str(row["id"]),
            "match_id": str(row["match_id"]),
            "signal": row["signal"],
            "created_at": row["created_at"].isoformat(),
        },
        status_code=201,
    )


@router.get("/feedback/me")
async def list_my_feedback(limit: int = Query(default=20, ge=1, le=100), auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        recent = await fetch_dict(
            conn,
            """
            SELECT mf.id, mf.match_id, mf.signal, mf.created_at
            FROM match_feedback mf
            WHERE mf.actor_user_id = $1
            ORDER BY mf.created_at DESC
            LIMIT $2
            """,
            auth.user_id,
            limit,
        )

        pending_received = await fetch_dict(
            conn,
            """
            SELECT DISTINCT ON (mf.match_id)
                mf.match_id,
                mf.created_at,
                sender.id AS sender_id,
                sender.name AS sender_name,
                sender.github_url,
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
                receiver.name AS receiver_name,
                receiver.github_url
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
            "recent": [
                {
                    "id": str(item["id"]),
                    "match_id": str(item["match_id"]),
                    "signal": item["signal"],
                    "created_at": item["created_at"].isoformat(),
                }
                for item in recent
            ],
            "pending_received": [
                {
                    "match_id": str(item["match_id"]),
                    "created_at": item["created_at"].isoformat(),
                    "sender": {
                        "id": str(item["sender_id"]),
                        "name": item["sender_name"],
                        "github_url": item.get("github_url"),
                    },
                    "my_idea": {
                        "id": str(item["my_idea_id"]),
                        "problem": item["my_idea_problem"],
                    },
                }
                for item in pending_received
            ],
            "pending_sent": [
                {
                    "match_id": str(item["match_id"]),
                    "created_at": item["created_at"].isoformat(),
                    "receiver": {
                        "id": str(item["receiver_id"]),
                        "name": item["receiver_name"],
                        "github_url": item.get("github_url"),
                    },
                }
                for item in pending_sent
            ],
        }
    )
