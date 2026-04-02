from typing import Optional

from pydantic import BaseModel


class MatchQueryParams(BaseModel):
    limit: int = 20
    cursor: Optional[str] = None
    min_score: float = 0.0
