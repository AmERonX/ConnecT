from typing import Optional

from pydantic import BaseModel


class TeamCreateRequest(BaseModel):
    match_id: str
    name: Optional[str] = None


class TeamUpdateRequest(BaseModel):
    name: Optional[str] = None


class PeerRatingRequest(BaseModel):
    rated_user_id: str
    reliability: int
    communication: int
    contribution: int
    overall_score: int


class TeamMemberCompleteRequest(BaseModel):
    complete: bool
