import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import pytest
from fastapi import BackgroundTasks

from app.auth import AuthContext
from app.errors import AppError
from app.models.idea import IdeaCreateRequest, IdeaUpdateRequest
from app.routes import ideas as ideas_route
from app.routes import pipeline as pipeline_route


class FakeConn:
    def transaction(self):
        @asynccontextmanager
        async def _tx():
            yield self

        return _tx()


def _idea_row(**overrides):
    now = datetime.now(timezone.utc)
    payload = {
        "id": "idea-123",
        "user_id": "user-123",
        "problem": "Problem",
        "solution_idea": "Solution",
        "approach": "Approach",
        "tags": ["ai"],
        "commitment_hrs": 10,
        "duration_weeks": 8,
        "is_active": True,
        "canonical_text": "Canonical summary",
        "match_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    payload.update(overrides)
    return payload


def test_run_pipeline_route_returns_202_and_runs_workers(monkeypatch):
    triggered = []

    async def fake_run_once():
        triggered.append(True)

    monkeypatch.setattr(pipeline_route, "run_pipeline_once", fake_run_once)

    response = asyncio.run(
        pipeline_route.run_pipeline(
            auth=AuthContext(user_id="user-123", email="user@example.com", token="token"),
        )
    )

    assert response.status_code == 202
    assert json.loads(response.body) == {"data": {"triggered": True}}
    assert triggered == [True]


def test_run_pipeline_route_surfaces_worker_errors(monkeypatch):
    async def fail_run_once():
        raise AppError(code="PIPELINE_UNAVAILABLE", message="down", status_code=503)

    monkeypatch.setattr(pipeline_route, "run_pipeline_once", fail_run_once)

    with pytest.raises(AppError) as exc_info:
        asyncio.run(
            pipeline_route.run_pipeline(
                auth=AuthContext(user_id="user-123", email="user@example.com", token="token"),
            )
        )

    assert exc_info.value.code == "PIPELINE_UNAVAILABLE"


def test_create_idea_enqueues_pipeline(monkeypatch):
    @asynccontextmanager
    async def fake_service_connection():
        yield FakeConn()

    @asynccontextmanager
    async def fake_connection(_user_id):
        yield FakeConn()

    scheduled = []

    async def fake_ensure_user_exists(_conn, _user_id, _email):
        return None

    async def fake_fetchrow_dict(_conn, _query, *args):
        return _idea_row(
            problem=args[1],
            solution_idea=args[2],
            approach=args[3],
            tags=args[4],
            commitment_hrs=args[5],
            duration_weeks=args[6],
            canonical_text=args[7],
        )

    async def fake_compute_freshness(_conn, _row):
        return "computing"

    def fake_enqueue(background_tasks):
        scheduled.append(background_tasks)

    monkeypatch.setattr(ideas_route.db, "service_connection", fake_service_connection)
    monkeypatch.setattr(ideas_route.db, "connection", fake_connection)
    monkeypatch.setattr(ideas_route, "ensure_user_exists", fake_ensure_user_exists)
    monkeypatch.setattr(ideas_route, "fetchrow_dict", fake_fetchrow_dict)
    monkeypatch.setattr(ideas_route, "compute_idea_freshness", fake_compute_freshness)
    monkeypatch.setattr(ideas_route, "enqueue_pipeline_run", fake_enqueue)

    response = asyncio.run(
        ideas_route.create_idea(
            body=IdeaCreateRequest(
                problem="New idea",
                solution_idea="Match people",
                approach="Embeddings",
                tags=["ai"],
                commitment_hrs=6,
                duration_weeks=4,
                canonical_text="Canonical summary",
            ),
            background_tasks=BackgroundTasks(),
            auth=AuthContext(user_id="user-123", email="user@example.com", token="token"),
        )
    )

    body = json.loads(response.body)
    assert response.status_code == 201
    assert body["data"]["problem"] == "New idea"
    assert len(scheduled) == 1


def test_patch_idea_enqueues_pipeline_only_for_intent_changes(monkeypatch):
    row_existing = _idea_row(problem="Original")
    row_updated = _idea_row(problem="Updated")

    @asynccontextmanager
    async def fake_connection(_user_id):
        yield FakeConn()

    rows = iter([row_existing, row_updated])
    scheduled = []

    async def fake_fetchrow_dict(_conn, _query, *args):
        return next(rows)

    async def fake_compute_freshness(_conn, _row):
        return "computing"

    def fake_enqueue(background_tasks):
        scheduled.append(background_tasks)

    monkeypatch.setattr(ideas_route.db, "connection", fake_connection)
    monkeypatch.setattr(ideas_route, "fetchrow_dict", fake_fetchrow_dict)
    monkeypatch.setattr(ideas_route, "compute_idea_freshness", fake_compute_freshness)
    monkeypatch.setattr(ideas_route, "enqueue_pipeline_run", fake_enqueue)

    response = asyncio.run(
        ideas_route.patch_idea(
            idea_id="idea-123",
            body=IdeaUpdateRequest(problem="Updated"),
            background_tasks=BackgroundTasks(),
            auth=AuthContext(user_id="user-123", email="user@example.com", token="token"),
        )
    )

    assert response.status_code == 200
    assert len(scheduled) == 1


def test_patch_idea_skips_pipeline_for_non_intent_changes(monkeypatch):
    row_existing = _idea_row(commitment_hrs=5)
    row_updated = _idea_row(commitment_hrs=12)

    @asynccontextmanager
    async def fake_connection(_user_id):
        yield FakeConn()

    rows = iter([row_existing, row_updated])
    scheduled = []

    async def fake_fetchrow_dict(_conn, _query, *args):
        return next(rows)

    async def fake_compute_freshness(_conn, _row):
        return "fresh"

    def fake_enqueue(background_tasks):
        scheduled.append(background_tasks)

    monkeypatch.setattr(ideas_route.db, "connection", fake_connection)
    monkeypatch.setattr(ideas_route, "fetchrow_dict", fake_fetchrow_dict)
    monkeypatch.setattr(ideas_route, "compute_idea_freshness", fake_compute_freshness)
    monkeypatch.setattr(ideas_route, "enqueue_pipeline_run", fake_enqueue)

    response = asyncio.run(
        ideas_route.patch_idea(
            idea_id="idea-123",
            body=IdeaUpdateRequest(commitment_hrs=12),
            background_tasks=BackgroundTasks(),
            auth=AuthContext(user_id="user-123", email="user@example.com", token="token"),
        )
    )

    assert response.status_code == 200
    assert scheduled == []

