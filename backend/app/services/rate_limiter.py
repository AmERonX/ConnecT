from collections import defaultdict, deque
from time import time

from app.errors import AppError


class InMemoryRateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._buckets: dict[str, deque[float]] = defaultdict(deque)

    def check(self, user_id: str) -> None:
        now = time()
        bucket = self._buckets[user_id]
        cutoff = now - self.window_seconds

        while bucket and bucket[0] < cutoff:
            bucket.popleft()

        if len(bucket) >= self.limit:
            raise AppError(
                code="RATE_LIMITED",
                message="Too many canonicalization requests. Please wait and try again.",
                status_code=429,
            )

        bucket.append(now)


canonicalize_rate_limiter = InMemoryRateLimiter(limit=10, window_seconds=60)
