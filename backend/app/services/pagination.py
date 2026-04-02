import base64
import json
from typing import Optional

from app.errors import AppError


def encode_cursor(score: float, match_id: str) -> str:
    payload = {"score": score, "id": match_id}
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("utf-8")


def decode_cursor(cursor: str) -> tuple[float, str]:
    try:
        data = json.loads(base64.urlsafe_b64decode(cursor.encode("utf-8") + b"===").decode("utf-8"))
        return float(data["score"]), str(data["id"])
    except Exception as exc:
        raise AppError(code="VALIDATION_ERROR", message="Invalid cursor.", status_code=422) from exc


def next_cursor(items: list[dict], limit: int) -> tuple[list[dict], Optional[str]]:
    if len(items) <= limit:
        return items, None

    trimmed = items[:limit]
    last = trimmed[-1]
    return trimmed, encode_cursor(float(last["final_score"]), str(last["match_id"]))
