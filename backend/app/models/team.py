from typing import Optional

from pydantic import BaseModel


class TeamCreateRequest(BaseModel):
    match_id: str
    name: Optional[str] = None
