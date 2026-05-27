"""
Rationale Generation Worker

Finds high-scoring matches that are missing a rationale and generates
a human-readable explanation using the Cohere LLM. Results are stored
in the `match_rationales` table.
"""
import logging

import cohere

from app.config import settings
from app.db import db, fetch_dict, fetchrow_dict

log = logging.getLogger(__name__)

# How many matches to process per run
_BATCH_SIZE = 10

# Minimum blend_score to bother generating a rationale for
_MIN_SCORE_THRESHOLD = 0.4

_RATIONALE_PROMPT_TEMPLATE = """\
You are a concise technical writer helping developers find project collaborators.

Given two project ideas, write a single short paragraph (40-60 words) explaining
why these two ideas are a strong match. Focus on:
- How the skill sets of each team complement each other
- How the commitment levels align
- What makes the problem spaces synergistic

Do NOT use marketing language or hyperbole. Be direct and specific.

---
Idea A: {idea_a}

Idea B: {idea_b}

Skill set A owner brings: {skills_a}
Skill set B owner brings: {skills_b}

Commitment A: {commitment_a}
Commitment B: {commitment_b}

Blend score: {blend_score:.2f} (embedding: {embedding_sim:.2f}, skill fit: {skill_complement:.2f}, commitment compat: {commitment_compat:.2f})
---

Write the rationale paragraph now. Output ONLY the paragraph, no headings, no JSON.
"""

_MODEL = "command-r-08-2024"


def _build_rationale_prompt(row: dict) -> str:
    return _RATIONALE_PROMPT_TEMPLATE.format(
        idea_a=row.get("problem_a") or "(unknown)",
        idea_b=row.get("problem_b") or "(unknown)",
        skills_a=", ".join(row.get("skills_a") or []) or "not specified",
        skills_b=", ".join(row.get("skills_b") or []) or "not specified",
        commitment_a=row.get("commitment_level_a") or "unspecified",
        commitment_b=row.get("commitment_level_b") or "unspecified",
        blend_score=float(row.get("blend_score") or 0),
        embedding_sim=float(row.get("embedding_sim") or 0),
        skill_complement=float(row.get("skill_complement") or 0),
        commitment_compat=float(row.get("commitment_compat") or 0),
    )


def _call_llm(prompt: str, client: cohere.ClientV2) -> str:
    """Call Cohere LLM with one retry."""
    messages = [{"role": "user", "content": prompt}]
    for attempt in range(2):
        try:
            response = client.chat(model=_MODEL, messages=messages, max_tokens=200)
            return response.message.content[0].text.strip()
        except Exception as exc:  # noqa: BLE001
            if attempt == 1:
                raise RuntimeError(f"LLM call failed after retry: {exc}") from exc
    return ""  # unreachable


async def run_rationale_worker(batch_size: int = _BATCH_SIZE) -> int:
    """
    Find up to `batch_size` high-scoring matches that are missing rationales,
    generate an LLM rationale for each, and persist to `match_rationales`.

    Returns the number of rationales successfully written.
    """
    client = cohere.ClientV2(api_key=settings.cohere_api_key)
    written = 0

    async with db.service_connection() as conn:
        # Fetch candidates: scored, non-stale, no existing rationale
        candidates = await fetch_dict(
            conn,
            """
            SELECT
                m.id           AS match_id,
                m.blend_score,
                m.embedding_sim,
                m.skill_complement,
                m.commitment_compat,
                pi_a.problem   AS problem_a,
                pi_b.problem   AS problem_b,
                pi_a.commitment_level AS commitment_level_a,
                pi_b.commitment_level AS commitment_level_b,
                pi_a.user_id   AS user_a_id,
                pi_b.user_id   AS user_b_id
            FROM matches m
            JOIN project_ideas pi_a ON pi_a.id = m.idea_a_id
            JOIN project_ideas pi_b ON pi_b.id = m.idea_b_id
            LEFT JOIN match_rationales mr ON mr.match_id = m.id
            WHERE m.is_stale = false
              AND m.blend_score IS NOT NULL
              AND m.blend_score >= $1
              AND mr.match_id IS NULL
            ORDER BY m.blend_score DESC
            LIMIT $2
            """,
            _MIN_SCORE_THRESHOLD,
            batch_size,
        )

        if not candidates:
            log.info("rationale_worker: no candidates found")
            return 0

        # Fetch skills for all involved users in one query
        user_ids = list({str(r["user_a_id"]) for r in candidates} | {str(r["user_b_id"]) for r in candidates})

        skills_rows = await fetch_dict(
            conn,
            """
            SELECT user_id::text, ARRAY_AGG(skill_name) AS skills
            FROM user_skills
            WHERE user_id = ANY($1::uuid[])
            GROUP BY user_id
            """,
            user_ids,
        )
        skills_by_user: dict[str, list[str]] = {r["user_id"]: list(r["skills"] or []) for r in skills_rows}

        for row in candidates:
            match_id = str(row["match_id"])
            row["skills_a"] = skills_by_user.get(str(row["user_a_id"]), [])
            row["skills_b"] = skills_by_user.get(str(row["user_b_id"]), [])

            try:
                prompt = _build_rationale_prompt(row)
                rationale_text = _call_llm(prompt, client)

                if not rationale_text:
                    log.warning("rationale_worker: empty LLM response for match %s", match_id)
                    continue

                await conn.execute(
                    """
                    INSERT INTO match_rationales (match_id, rationale_text, model_used)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (match_id) DO UPDATE
                        SET rationale_text = EXCLUDED.rationale_text,
                            generated_at   = now(),
                            model_used     = EXCLUDED.model_used
                    """,
                    match_id,
                    rationale_text,
                    _MODEL,
                )
                written += 1
                log.info("rationale_worker: wrote rationale for match %s (score=%.3f)", match_id, row["blend_score"])

            except Exception:  # noqa: BLE001
                log.exception("rationale_worker: failed for match %s", match_id)
                continue

    log.info("rationale_worker: done — %d/%d rationales written", written, len(candidates))
    return written
