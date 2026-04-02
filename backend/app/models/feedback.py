from typing import Literal

from pydantic import BaseModel


FeedbackSignal = Literal[
    "connection_sent",
    "connection_accepted",
    "profile_viewed",
    "dismissed",
]


class FeedbackCreateRequest(BaseModel):
    match_id: str
    signal: FeedbackSignal
