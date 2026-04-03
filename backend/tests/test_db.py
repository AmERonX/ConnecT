import asyncio
from types import SimpleNamespace

import pytest

from app import db as db_module
from app.errors import AppError


class FakeConnection:
    def __init__(self, fail_on_reset: bool = False):
        self.fail_on_reset = fail_on_reset
        self.commands: list[tuple[str, tuple]] = []
        self.terminated = False

    async def execute(self, query: str, *args):
        self.commands.append((query, args))
        if self.fail_on_reset and query == "RESET ROLE":
            raise RuntimeError("reset failed")

    def terminate(self):
        self.terminated = True


class FakePool:
    def __init__(self, conn: FakeConnection):
        self.conn = conn
        self.acquire_count = 0
        self.release_count = 0

    async def acquire(self):
        self.acquire_count += 1
        return self.conn

    async def release(self, _conn):
        self.release_count += 1


def test_connect_warmup_does_not_raise_on_db_error(monkeypatch):
    async def fail_get_pool(self):
        raise AppError(code="DB_UNAVAILABLE", message="down", status_code=503)

    monkeypatch.setattr(db_module.Database, "_get_pool", fail_get_pool)

    database = db_module.Database()

    # Warm-up must not crash startup if DB is temporarily unavailable.
    asyncio.run(database.connect())


def test_connection_releases_even_when_reset_fails():
    conn = FakeConnection(fail_on_reset=True)
    pool = FakePool(conn)

    database = db_module.Database()
    database.pool = pool

    async def _run():
        async with database.connection("user-123"):
            pass

    asyncio.run(_run())

    assert pool.acquire_count == 1
    assert pool.release_count == 1
    assert conn.terminated is True


def test_connection_translates_acquire_failures_to_503():
    class FailingPool:
        async def acquire(self):
            raise TimeoutError("timed out")

        async def release(self, _conn):
            raise AssertionError("release should not be called")

    database = db_module.Database()
    database.pool = FailingPool()

    async def _run():
        async with database.connection("user-123"):
            pass

    with pytest.raises(AppError) as exc_info:
        asyncio.run(_run())

    assert exc_info.value.code == "DB_UNAVAILABLE"
    assert exc_info.value.status_code == 503


def test_pool_creation_uses_transaction_pooler_safe_settings(monkeypatch):
    captured = {}

    async def fake_create_pool(**kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(db_module.asyncpg, "create_pool", fake_create_pool)
    monkeypatch.setattr(
        db_module,
        "settings",
        SimpleNamespace(
            supabase_db_url="postgresql://example",
            db_pool_min_size=0,
            db_pool_max_size=4,
            db_pool_acquire_timeout=5.0,
            db_statement_cache_size=0,
        ),
    )

    database = db_module.Database()
    asyncio.run(database._get_pool())

    assert captured["min_size"] == 0
    assert captured["max_size"] == 4
    assert captured["statement_cache_size"] == 0
    assert captured["timeout"] == 5.0