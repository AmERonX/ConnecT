from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class CanonicalizeInputFields(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    problem: str = Field(alias="Problem")
    solution_idea: str = Field(alias="Solution Idea")
    approach: str = Field(alias="Approach")
    tags: list[str] = Field(default_factory=list, alias="Tags")


class CanonicalizeRequest(BaseModel):
    input: CanonicalizeInputFields
    previous_canonical_text: Optional[str] = None
    decline_reason: Optional[str] = None


class IdeaCreateRequest(BaseModel):
    problem: str
    solution_idea: Optional[str] = None
    approach: Optional[str] = None
    tags: Optional[list[str]] = None
    commitment_hrs: Optional[int] = None
    duration_weeks: Optional[int] = None
    canonical_text: str


class IdeaUpdateRequest(BaseModel):
    problem: Optional[str] = None
    solution_idea: Optional[str] = None
    approach: Optional[str] = None
    tags: Optional[list[str]] = None
    commitment_hrs: Optional[int] = None
    duration_weeks: Optional[int] = None
    is_active: Optional[bool] = None
    canonical_text: Optional[str] = None


class IdeaResponse(BaseModel):
    id: str
    user_id: str
    problem: str
    solution_idea: Optional[str] = None
    approach: Optional[str] = None
    tags: Optional[list[str]] = None
    commitment_hrs: Optional[int] = None
    duration_weeks: Optional[int] = None
    is_active: bool
    freshness: str
    canonical_text: Optional[str] = None
    match_count: int = 0
    created_at: str
    updated_at: str


class PaginatedResponse(BaseModel):
    items: list[dict[str, Any]]
    next_cursor: Optional[str] = None
    total: int