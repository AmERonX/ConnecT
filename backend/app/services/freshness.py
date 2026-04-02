from typing import Any

from app.db import fetchrow_dict


def compute_freshness_from_flags(canonical_text: str | None, embedding_stale: bool, has_stale_match: bool) -> str:
    if canonical_text is None:
        return "needs_input"
    if embedding_stale:
        return "computing"
    if has_stale_match:
        return "partial"
    return "fresh"


async def idea_has_stale_match(conn, idea_id: str) -> bool:
    row = await fetchrow_dict(
        conn,
        """
        SELECT EXISTS (
            SELECT 1
            FROM matches m
            JOIN match_participants mp ON mp.match_id = m.id
            WHERE mp.idea_id = $1
              AND m.is_stale = true
        ) AS has_stale
        """,
        idea_id,
    )
    return bool(row and row["has_stale"])


async def compute_idea_freshness(conn, idea_row: dict[str, Any]) -> str:
    has_stale = False
    if not idea_row.get("embedding_stale") and idea_row.get("canonical_text") is not None:
        has_stale = await idea_has_stale_match(conn, str(idea_row["id"]))

    return compute_freshness_from_flags(
        canonical_text=idea_row.get("canonical_text"),
        embedding_stale=bool(idea_row.get("embedding_stale")),
        has_stale_match=has_stale,
    )
