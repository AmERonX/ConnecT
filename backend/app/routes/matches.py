from fastapi import APIRouter, Depends, Query

from app.auth import AuthContext, get_auth_context
from app.db import db, fetch_dict, fetchrow_dict
from app.errors import AppError
from app.responses import success_response
from app.services.freshness import compute_idea_freshness
from app.services.pagination import decode_cursor, next_cursor

router = APIRouter(tags=["matches"])


def _passes_hard_filters(viewer_idea: dict, candidate_idea: dict, candidate_user: dict) -> bool:
    if candidate_user.get("has_existing_team"):
        return False
    return True


@router.get("/ideas/{idea_id}/matches")
async def list_matches_for_idea(
    idea_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
    min_score: float = Query(default=0.0),
    auth: AuthContext = Depends(get_auth_context),
):
    async with db.service_connection() as conn:
        viewer_idea = await fetchrow_dict(
            conn,
            """
            SELECT *
            FROM project_ideas
            WHERE id = $1 AND is_active = true
            """,
            idea_id,
        )

        if not viewer_idea:
            raise AppError(code="NOT_FOUND", message="No idea found with this ID.", status_code=404)
        if str(viewer_idea["user_id"]) != auth.user_id:
            raise AppError(code="FORBIDDEN", message="You do not own this idea.", status_code=403)

        freshness = await compute_idea_freshness(conn, viewer_idea)
        if freshness in {"computing", "needs_input"}:
            return success_response(
                {
                    "idea_id": idea_id,
                    "freshness": freshness,
                    "items": [],
                    "next_cursor": None,
                    "total": 0,
                }
            )

        cursor_score = None
        cursor_id = None
        if cursor:
            cursor_score, cursor_id = decode_cursor(cursor)

        query = """
            SELECT
                m.id AS match_id,
                m.final_score,
                m.similarity_score,
                m.explanation,
                m.is_stale,
                m.computed_at,
                pi.id AS other_idea_id,
                pi.problem,
                pi.commitment_hrs,
                pi.user_id AS owner_id,
                p.name AS owner_name,
                p.github_url,
                p.has_existing_team,
                pi.is_active
            FROM matches m
            JOIN match_participants mp ON mp.match_id = m.id
            JOIN LATERAL (
                SELECT pi2.*
                FROM match_participants mp2
                JOIN project_ideas pi2 ON pi2.id = mp2.idea_id
                WHERE mp2.match_id = m.id AND mp2.idea_id != $1
                LIMIT 1
            ) pi ON true
            JOIN public_profiles p ON p.id = pi.user_id
            WHERE mp.idea_id = $1
              AND m.final_score IS NOT NULL
              AND m.final_score >= $2
              AND pi.is_active = true
        """

        params = [idea_id, min_score]
        if cursor_score is not None and cursor_id is not None:
            query += " AND (m.final_score < $3 OR (m.final_score = $3 AND m.id > $4))"
            params.extend([cursor_score, cursor_id])
            order_index = 5
        else:
            order_index = 3

        query += f" ORDER BY m.final_score DESC, m.id ASC LIMIT ${order_index}"
        params.append(min(limit * 5, 500))

        rows = await fetch_dict(conn, query, *params)

        filtered = []
        for row in rows:
            candidate_idea = {"commitment_hrs": row.get("commitment_hrs")}
            candidate_user = {"has_existing_team": row.get("has_existing_team")}
            if not _passes_hard_filters(viewer_idea, candidate_idea, candidate_user):
                continue

            filtered.append(
                {
                    "match_id": str(row["match_id"]),
                    "is_stale": bool(row["is_stale"]),
                    "final_score": float(row["final_score"]),
                    "similarity_score": float(row["similarity_score"]),
                    "explanation": row.get("explanation"),
                    "computed_at": row["computed_at"].isoformat() if row.get("computed_at") else None,
                    "matched_idea": {
                        "id": str(row["other_idea_id"]),
                        "problem": row["problem"],
                        "commitment_hrs": row.get("commitment_hrs"),
                        "owner": {
                            "id": str(row["owner_id"]),
                            "name": row["owner_name"],
                            "github_url": row.get("github_url"),
                        },
                    },
                }
            )

        total_row = await fetchrow_dict(
            conn,
            """
            SELECT COUNT(*)::int AS total
            FROM matches m
            JOIN match_participants mp ON mp.match_id = m.id
            WHERE mp.idea_id = $1
              AND m.final_score IS NOT NULL
              AND m.final_score >= $2
            """,
            idea_id,
            min_score,
        )

    items, next_token = next_cursor(filtered, limit)
    return success_response(
        {
            "idea_id": idea_id,
            "freshness": freshness,
            "items": items,
            "next_cursor": next_token,
            "total": total_row["total"] if total_row else len(items),
        }
    )
