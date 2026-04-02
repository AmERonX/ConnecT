from typing import Any

from fastapi import APIRouter, Depends

from app.auth import AuthContext, get_auth_context
from app.db import db, ensure_user_exists, fetch_dict, fetchrow_dict
from app.errors import AppError
from app.models.idea import CanonicalizeRequest, IdeaCreateRequest, IdeaUpdateRequest
from app.responses import success_response
from app.services.canonicalize import canonicalize, get_client
from app.services.freshness import compute_idea_freshness
from app.services.idea_updates import build_idea_update_payload
from app.services.rate_limiter import canonicalize_rate_limiter

router = APIRouter(prefix="/ideas", tags=["ideas"])
cohere_client = get_client()


async def _serialize_idea(conn, row: dict[str, Any], requester_id: str) -> dict[str, Any]:
    freshness = await compute_idea_freshness(conn, row)
    return {
        "id": str(row["id"]),
        "user_id": str(row["user_id"]),
        "problem": row["problem"],
        "solution_idea": row.get("solution_idea"),
        "approach": row.get("approach"),
        "tags": row.get("tags"),
        "commitment_hrs": row.get("commitment_hrs"),
        "duration_weeks": row.get("duration_weeks"),
        "is_active": bool(row["is_active"]),
        "freshness": freshness,
        "canonical_text": row.get("canonical_text") if str(row["user_id"]) == requester_id else None,
        "created_at": row["created_at"].isoformat(),
        "updated_at": row["updated_at"].isoformat(),
    }


def _normalize_for_compare(value: Any) -> Any:
    if isinstance(value, list):
        return list(value)
    return value


def _changed_fields(existing: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    changed: dict[str, Any] = {}
    for key, value in incoming.items():
        if _normalize_for_compare(existing.get(key)) != _normalize_for_compare(value):
            changed[key] = value
    return changed


@router.post("/canonicalize")
async def canonicalize_idea(body: CanonicalizeRequest, auth: AuthContext = Depends(get_auth_context)):
    canonicalize_rate_limiter.check(auth.user_id)

    try:
        result = canonicalize(body.input.model_dump(by_alias=True), cohere_client)
    except RuntimeError as exc:
        raise AppError(
            code="SERVICE_UNAVAILABLE",
            message="Canonicalization service temporarily unavailable.",
            status_code=503,
        ) from exc
    except ValueError as exc:
        result = {"status": "error", "error": str(exc)}

    return success_response(result)


@router.post("")
async def create_idea(body: IdeaCreateRequest, auth: AuthContext = Depends(get_auth_context)):
    if not body.canonical_text.strip():
        raise AppError(code="VALIDATION_ERROR", message="canonical_text is required.", status_code=422)

    async with db.service_connection() as service_conn:
        await ensure_user_exists(service_conn, auth.user_id, auth.email)

    async with db.connection(auth.user_id) as conn:
        row = await fetchrow_dict(
            conn,
            """
            INSERT INTO project_ideas
                (user_id, problem, solution_idea, approach, tags,
                 commitment_hrs, duration_weeks, canonical_text, embedding_stale)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, true)
            RETURNING *
            """,
            auth.user_id,
            body.problem,
            body.solution_idea,
            body.approach,
            body.tags,
            body.commitment_hrs,
            body.duration_weeks,
            body.canonical_text,
        )

        serialized = await _serialize_idea(conn, row, auth.user_id)

    return success_response(serialized, status_code=201)


@router.get("/me")
async def list_my_ideas(auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        rows = await fetch_dict(
            conn,
            """
            SELECT *
            FROM project_ideas
            WHERE user_id = $1 AND is_active = true
            ORDER BY created_at DESC
            """,
            auth.user_id,
        )

        items = []
        for row in rows:
            items.append(await _serialize_idea(conn, row, auth.user_id))

    return success_response(items)


@router.get("/{idea_id}")
async def get_idea(idea_id: str, auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        row = await fetchrow_dict(
            conn,
            """
            SELECT *
            FROM project_ideas
            WHERE id = $1 AND is_active = true
            """,
            idea_id,
        )

        if not row:
            raise AppError(code="NOT_FOUND", message="No idea found with this ID.", status_code=404)

        serialized = await _serialize_idea(conn, row, auth.user_id)

    return success_response(serialized)


@router.patch("/{idea_id}")
async def patch_idea(idea_id: str, body: IdeaUpdateRequest, auth: AuthContext = Depends(get_auth_context)):
    requested_fields = body.model_dump(exclude_none=True)

    async with db.connection(auth.user_id) as conn:
        existing = await fetchrow_dict(
            conn,
            """
            SELECT *
            FROM project_ideas
            WHERE id = $1
            """,
            idea_id,
        )

        if not existing or not existing.get("is_active"):
            raise AppError(code="NOT_FOUND", message="No idea found with this ID.", status_code=404)

        if str(existing["user_id"]) != auth.user_id:
            raise AppError(code="FORBIDDEN", message="You do not own this idea.", status_code=403)

        changed_fields = _changed_fields(existing, requested_fields)
        payload = build_idea_update_payload(changed_fields)

        if payload:
            assignments = []
            values = []
            for idx, (key, value) in enumerate(payload.items(), start=1):
                assignments.append(f"{key} = ${idx}")
                values.append(value)

            values.append(idea_id)

            async with conn.transaction():
                updated = await fetchrow_dict(
                    conn,
                    f"""
                    UPDATE project_ideas
                    SET {', '.join(assignments)}
                    WHERE id = ${len(values)}
                    RETURNING *
                    """,
                    *values,
                )
        else:
            updated = existing

        serialized = await _serialize_idea(conn, updated, auth.user_id)

    return success_response(serialized)


@router.delete("/{idea_id}")
async def delete_idea(idea_id: str, auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        existing = await fetchrow_dict(conn, "SELECT id, user_id FROM project_ideas WHERE id = $1", idea_id)

        if not existing:
            raise AppError(code="NOT_FOUND", message="No idea found with this ID.", status_code=404)
        if str(existing["user_id"]) != auth.user_id:
            raise AppError(code="FORBIDDEN", message="You do not own this idea.", status_code=403)

        await conn.execute(
            """
            UPDATE project_ideas
            SET is_active = false, updated_at = now()
            WHERE id = $1
            """,
            idea_id,
        )

    return success_response(None)
