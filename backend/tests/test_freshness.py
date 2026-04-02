from app.services.freshness import compute_freshness_from_flags


def test_freshness_needs_input():
    assert compute_freshness_from_flags(None, True, False) == "needs_input"


def test_freshness_computing():
    assert compute_freshness_from_flags("x", True, False) == "computing"


def test_freshness_partial():
    assert compute_freshness_from_flags("x", False, True) == "partial"


def test_freshness_fresh():
    assert compute_freshness_from_flags("x", False, False) == "fresh"
