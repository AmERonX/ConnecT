from fastapi import APIRouter, Depends

from app.auth import AuthContext, get_auth_context
from app.db import db, ensure_user_exists, fetchrow_dict
from app.errors import AppError
from app.models.user import UserUpdateRequest, UserSkillCreateRequest
from app.responses import success_response

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
async def get_me(auth: AuthContext = Depends(get_auth_context)):
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
    payload = body.model_dump(exclude_none=True)

    async with db.service_connection() as service_conn:
        await ensure_user_exists(service_conn, auth.user_id, auth.email)

    async with db.connection(auth.user_id) as conn:
        if payload:
            assignments = []
            values = []
            for index, (key, value) in enumerate(payload.items(), start=1):
                assignments.append(f"{key} = ${index}")
                values.append(value)

            values.append(auth.user_id)

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


@router.delete("/me")
async def delete_me(auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        await conn.execute("DELETE FROM users WHERE id = $1", auth.user_id)
    return success_response(None)


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


@router.post("/me/skills")
async def add_skill(body: UserSkillCreateRequest, auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        row = await fetchrow_dict(
            conn,
            """
            INSERT INTO user_skills (user_id, skill_name, level)
            VALUES ($1, $2, $3)
            RETURNING id, skill_name, level, verified
            """,
            auth.user_id,
            body.skill_name,
            body.level,
        )

    return success_response({
        "id": str(row["id"]),
        "skill_name": row["skill_name"],
        "level": row["level"],
        "verified": bool(row["verified"]),
    }, status_code=201)


@router.delete("/me/skills/{skill_id}")
async def delete_skill(skill_id: str, auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        result = await conn.execute(
            """
            DELETE FROM user_skills
            WHERE id = $1 AND user_id = $2
            """,
            skill_id,
            auth.user_id,
        )
        if result == "DELETE 0":
            raise AppError(code="NOT_FOUND", message="Skill not found.", status_code=404)

    return success_response(None)
