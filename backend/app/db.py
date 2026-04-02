from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Optional

import asyncpg

from app.config import settings


class Database:
    def __init__(self) -> None:
        self.pool: Optional[asyncpg.Pool] = None
        self.service_pool: Optional[asyncpg.Pool] = None

    async def connect(self) -> None:
        if not self.pool:
            self.pool = await asyncpg.create_pool(dsn=settings.supabase_db_url, min_size=1, max_size=10)
        if not self.service_pool:
            self.service_pool = await asyncpg.create_pool(
                dsn=settings.supabase_service_db_url,
                min_size=1,
                max_size=5,
            )

    async def disconnect(self) -> None:
        if self.pool:
            await self.pool.close()
            self.pool = None
        if self.service_pool:
            await self.service_pool.close()
            self.service_pool = None

    @asynccontextmanager
    async def connection(self, user_id: Optional[str] = None) -> AsyncIterator[asyncpg.Connection]:
        if not self.pool:
            await self.connect()
        conn = await self.pool.acquire()
        try:
            if user_id:
                await conn.execute("SET ROLE authenticated")
                await conn.execute("SELECT set_config('request.jwt.claim.sub', $1, false)", user_id)
                await conn.execute("SELECT set_config('request.jwt.claim.role', 'authenticated', false)")
            yield conn
        finally:
            if user_id:
                await conn.execute("RESET ROLE")
                await conn.execute("RESET request.jwt.claim.sub")
                await conn.execute("RESET request.jwt.claim.role")
            await self.pool.release(conn)

    @asynccontextmanager
    async def service_connection(self) -> AsyncIterator[asyncpg.Connection]:
        if not self.service_pool:
            await self.connect()
        conn = await self.service_pool.acquire()
        try:
            yield conn
        finally:
            await self.service_pool.release(conn)


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
