from fastapi import APIRouter, Depends

from app.auth import AuthContext, get_auth_context
from app.db import db, ensure_user_exists, fetchrow_dict
from app.errors import AppError
from app.models.user import UserUpdateRequest
from app.responses import success_response

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
async def get_me(auth: AuthContext = Depends(get_auth_context)):
    async with db.service_connection() as service_conn:
        await ensure_user_exists(service_conn, auth.user_id, auth.email)

    async with db.connection(auth.user_id) as conn:
        row = await fetchrow_dict(
            conn,
            """
            SELECT id, name, email, github_url, team_size_preference,
                   working_style, has_existing_team, created_at
            FROM users
            WHERE id = $1
            """,
            auth.user_id,
        )

    if not row:
        raise AppError(code="NOT_FOUND", message="User profile not found.", status_code=404)

    row["created_at"] = row["created_at"].isoformat()
    return success_response(row)


@router.patch("/me")
async def patch_me(body: UserUpdateRequest, auth: AuthContext = Depends(get_auth_context)):
    async with db.service_connection() as service_conn:
        await ensure_user_exists(service_conn, auth.user_id, auth.email)

    payload = body.model_dump(exclude_none=True)
    if not payload:
        return await get_me(auth)

    assignments = []
    values = []
    for index, (key, value) in enumerate(payload.items(), start=1):
        assignments.append(f"{key} = ${index}")
        values.append(value)

    values.append(auth.user_id)

    async with db.connection(auth.user_id) as conn:
        await conn.execute(
            f"""
            UPDATE users
            SET {', '.join(assignments)}
            WHERE id = ${len(values)}
            """,
            *values,
        )

        row = await fetchrow_dict(
            conn,
            """
            SELECT id, name, email, github_url, team_size_preference,
                   working_style, has_existing_team, created_at
            FROM users
            WHERE id = $1
            """,
            auth.user_id,
        )

    if not row:
        raise AppError(code="NOT_FOUND", message="User profile not found.", status_code=404)

    row["created_at"] = row["created_at"].isoformat()
    return success_response(row)


@router.get("/me/skills")
async def list_my_skills(auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        rows = await conn.fetch(
            """
            SELECT id, skill_name, level, verified
            FROM user_skills
            WHERE user_id = $1
            ORDER BY skill_name ASC
            """,
            auth.user_id,
        )

    items = [
        {
            "id": str(row["id"]),
            "skill_name": row["skill_name"],
            "level": row["level"],
            "verified": bool(row["verified"]),
        }
        for row in rows
    ]
    return success_response(items)
