from app.services.canonicalize import clean_json_output, validate_llm_output


def test_clean_json_output_handles_markdown_fencing():
    payload = """```json\n{\"status\":\"approved\",\"canonical_text\":\"hello\"}\n```"""
    parsed = clean_json_output(payload)
    assert parsed["status"] == "approved"
    assert parsed["canonical_text"] == "hello"


def test_validate_llm_output_rejects_missing_feedback():
    result = validate_llm_output({"status": "needs_revision"})
    assert result["status"] == "error"
    assert "Missing feedback" in result["error"]


def test_validate_llm_output_accepts_approved():
    result = validate_llm_output({"status": "approved", "canonical_text": "Valid text"})
    assert result["status"] == "approved"
