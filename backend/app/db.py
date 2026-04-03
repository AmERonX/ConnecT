import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Optional

import asyncpg

from app.config import settings
from app.errors import AppError

log = logging.getLogger(__name__)


def _is_capacity_error(exc: BaseException) -> bool:
    message = str(exc).lower()
    return (
        "max clients" in message
        or "too many clients" in message
        or "sorry, too many clients" in message
        or "cannot connect now" in message
        or "remaining connection slots are reserved" in message
    )


def _database_unavailable(exc: BaseException) -> AppError:
    message = "Database is temporarily unavailable. Please retry shortly."
    if _is_capacity_error(exc):
        message = "Database connection capacity reached. Please retry shortly."
    return AppError(code="DB_UNAVAILABLE", message=message, status_code=503)


class Database:
    def __init__(self) -> None:
        self.pool: Optional[asyncpg.Pool] = None
        self.service_pool: Optional[asyncpg.Pool] = None
        self._pool_lock = asyncio.Lock()
        self._service_pool_lock = asyncio.Lock()

    async def _create_pool(self, dsn: str, min_size: int, max_size: int) -> asyncpg.Pool:
        return await asyncpg.create_pool(
            dsn=dsn,
            min_size=min_size,
            max_size=max_size,
            timeout=settings.db_pool_acquire_timeout,
            command_timeout=settings.db_pool_acquire_timeout,
            statement_cache_size=settings.db_statement_cache_size,
        )

    async def _get_pool(self) -> asyncpg.Pool:
        if self.pool is not None:
            return self.pool

        async with self._pool_lock:
            if self.pool is None:
                try:
                    self.pool = await self._create_pool(
                        dsn=settings.supabase_db_url,
                        min_size=settings.db_pool_min_size,
                        max_size=settings.db_pool_max_size,
                    )
                except (asyncpg.PostgresError, OSError, TimeoutError) as exc:
                    raise _database_unavailable(exc) from exc

        return self.pool

    async def _get_service_pool(self) -> asyncpg.Pool:
        if self.service_pool is not None:
            return self.service_pool

        async with self._service_pool_lock:
            if self.service_pool is None:
                try:
                    self.service_pool = await self._create_pool(
                        dsn=settings.supabase_service_db_url,
                        min_size=settings.db_service_pool_min_size,
                        max_size=settings.db_service_pool_max_size,
                    )
                except (asyncpg.PostgresError, OSError, TimeoutError) as exc:
                    raise _database_unavailable(exc) from exc

        return self.service_pool

    async def connect(self) -> None:
        # Optional warm-up only. Request handlers still lazily initialize pools.
        try:
            await self._get_pool()
            await self._get_service_pool()
        except AppError as exc:
            log.warning("Skipping DB warm-up: %s", exc.message)

    async def disconnect(self) -> None:
        if self.pool:
            await self.pool.close()
            self.pool = None
        if self.service_pool:
            await self.service_pool.close()
            self.service_pool = None

    async def _acquire(self, pool: asyncpg.Pool) -> asyncpg.Connection:
        try:
            return await pool.acquire()
        except (asyncpg.PostgresError, OSError, TimeoutError) as exc:
            raise _database_unavailable(exc) from exc

    async def _release(self, pool: asyncpg.Pool, conn: asyncpg.Connection, should_terminate: bool = False) -> None:
        if should_terminate:
            try:
                conn.terminate()
            except Exception:
                log.debug("Failed to terminate connection before release", exc_info=True)

        try:
            await pool.release(conn)
        except Exception:
            log.exception("Failed to release DB connection")

    async def _apply_auth_context(self, conn: asyncpg.Connection, user_id: str) -> None:
        try:
            await conn.execute("SET ROLE authenticated")
            await conn.execute("SELECT set_config('request.jwt.claim.sub', $1, false)", user_id)
            await conn.execute("SELECT set_config('request.jwt.claim.role', 'authenticated', false)")
        except (asyncpg.PostgresError, OSError, TimeoutError) as exc:
            raise _database_unavailable(exc) from exc

    async def _clear_auth_context(self, conn: asyncpg.Connection) -> None:
        await conn.execute("RESET ROLE")
        await conn.execute("RESET request.jwt.claim.sub")
        await conn.execute("RESET request.jwt.claim.role")

    @asynccontextmanager
    async def connection(self, user_id: Optional[str] = None) -> AsyncIterator[asyncpg.Connection]:
        pool = await self._get_pool()
        conn = await self._acquire(pool)
        terminate_on_release = False

        try:
            if user_id:
                await self._apply_auth_context(conn, user_id)
            yield conn
        finally:
            if user_id:
                try:
                    await self._clear_auth_context(conn)
                except Exception:
                    # Never leak connections because of RESET failures.
                    terminate_on_release = True
                    log.warning("Failed to reset auth context; connection will be terminated", exc_info=True)

            await self._release(pool, conn, should_terminate=terminate_on_release)

    @asynccontextmanager
    async def service_connection(self) -> AsyncIterator[asyncpg.Connection]:
        pool = await self._get_service_pool()
        conn = await self._acquire(pool)
        try:
            yield conn
        finally:
            await self._release(pool, conn)


async def ensure_user_exists(conn: asyncpg.Connection, user_id: str, email: Optional[str]) -> None:
    await conn.execute(
        """
        INSERT INTO users (id, name, email)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO NOTHING
        """,
        user_id,
        "New User",
        email or f"{user_id}@unknown.local",
    )


async def fetchrow_dict(conn: asyncpg.Connection, query: str, *args: Any) -> Optional[dict[str, Any]]:
    row = await conn.fetchrow(query, *args)
    return dict(row) if row else None


async def fetch_dict(conn: asyncpg.Connection, query: str, *args: Any) -> list[dict[str, Any]]:
    rows = await conn.fetch(query, *args)
    return [dict(row) for row in rows]


db = Database()