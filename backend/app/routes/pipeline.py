from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.auth import AuthContext, get_auth_context
from app.db import db, fetchrow_dict
from app.responses import success_response
from app.services.pipeline import run_pipeline_once

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


@router.get("/status")
async def get_pipeline_status(auth: AuthContext = Depends(get_auth_context)):
    async with db.connection(auth.user_id) as conn:
        stale_ideas = await fetchrow_dict(
            conn,
            "SELECT COUNT(*)::int AS count FROM project_ideas WHERE embedding_stale = true",
        )
        stale_matches = await fetchrow_dict(
            conn,
            "SELECT COUNT(*)::int AS count FROM matches WHERE is_stale = true",
        )

    return success_response(
        {
            "stale_ideas_count": stale_ideas["count"] if stale_ideas else 0,
            "stale_matches_count": stale_matches["count"] if stale_matches else 0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )


@router.post("/run")
async def run_pipeline(auth: AuthContext = Depends(get_auth_context)):
    await run_pipeline_once()
    return success_response({"triggered": True}, status_code=202)
