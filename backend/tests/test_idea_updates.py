from app.services.idea_updates import build_idea_update_payload


def test_intent_patch_marks_stale_and_clears_canonical():
    payload = build_idea_update_payload({"problem": "new"})
    assert payload["embedding_stale"] is True
    assert payload["canonical_text"] is None


def test_non_intent_patch_does_not_mark_stale():
    payload = build_idea_update_payload({"commitment_hrs": 10})
    assert "embedding_stale" not in payload


def test_provided_canonical_marks_stale():
    payload = build_idea_update_payload({"canonical_text": "approved"})
    assert payload["embedding_stale"] is True
    assert payload["canonical_text"] == "approved"
