from typing import Any

INTENT_FIELDS = {"problem", "solution_idea", "approach", "tags"}


def build_idea_update_payload(payload: dict[str, Any]) -> dict[str, Any]:
    updated_fields = {k: v for k, v in payload.items() if v is not None}
    touches_intent = bool(set(updated_fields.keys()) & INTENT_FIELDS)

    if touches_intent:
        updated_fields["embedding_stale"] = True
        if "canonical_text" not in updated_fields:
            updated_fields["canonical_text"] = None

    if "canonical_text" in updated_fields and updated_fields["canonical_text"] is not None:
        updated_fields["embedding_stale"] = True

    return updated_fields
