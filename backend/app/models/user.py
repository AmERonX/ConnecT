from typing import Literal, Optional

from pydantic import BaseModel, EmailStr


WorkingStyle = Literal["async", "sync", "flexible"]


class UserProfile(BaseModel):
    id: str
    name: str
    email: EmailStr
    github_url: Optional[str] = None
    team_size_preference: Optional[int] = None
    working_style: Optional[WorkingStyle] = None
    has_existing_team: bool = False
    created_at: str


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    github_url: Optional[str] = None
    team_size_preference: Optional[int] = None
    working_style: Optional[WorkingStyle] = None
    has_existing_team: Optional[bool] = None
