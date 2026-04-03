import asyncio
from app.db import db

async def main():
    await db.connect()
    async with db.connection() as conn:
        q = """
        DROP POLICY IF EXISTS "match_participants: participants can read" ON match_participants;
        CREATE POLICY "match_participants: participants can read" ON match_participants
        FOR SELECT
        USING (
            EXISTS (
                SELECT 1
                FROM match_participants mp2
                JOIN project_ideas pi ON pi.id = mp2.idea_id
                WHERE mp2.match_id = match_participants.match_id
                  AND pi.user_id = auth.uid()
            )
        );
        """
        await conn.execute(q)
        print("Updated RLS policy successfully!")
    await db.disconnect()

asyncio.run(main())
