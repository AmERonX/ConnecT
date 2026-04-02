from app.services.pagination import decode_cursor, encode_cursor


def test_cursor_roundtrip():
    encoded = encode_cursor(0.91, "abc-123")
    score, match_id = decode_cursor(encoded)
    assert score == 0.91
    assert match_id == "abc-123"
