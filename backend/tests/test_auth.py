import asyncio

import pytest
from jwt import InvalidTokenError

from app import auth
from app.errors import AppError


def test_resolve_claims_prefers_verified_jwks(monkeypatch):
    async def fake_decode_with_jwks(token: str):
        assert token == "verified-token"
        return {"sub": "user-123", "email": "verified@example.com"}

    async def fake_fetch_user(token: str):
        raise AssertionError("fallback should not be used when JWKS verification succeeds")

    monkeypatch.setattr(auth, "_decode_with_jwks", fake_decode_with_jwks)
    monkeypatch.setattr(auth, "_fetch_user_with_supabase", fake_fetch_user)

    user_id, email = asyncio.run(auth._resolve_claims("verified-token"))

    assert user_id == "user-123"
    assert email == "verified@example.com"


def test_resolve_claims_falls_back_to_supabase_user_lookup(monkeypatch):
    async def fake_decode_with_jwks(token: str):
        raise InvalidTokenError("no matching signing key")

    async def fake_fetch_user(token: str):
        assert token == "fallback-token"
        return {"id": "user-456", "email": "user@example.com"}

    monkeypatch.setattr(auth, "_decode_with_jwks", fake_decode_with_jwks)
    monkeypatch.setattr(auth, "_fetch_user_with_supabase", fake_fetch_user)
    monkeypatch.setattr(auth, "_decode_unverified", lambda token: {"sub": "user-456", "email": "claim@example.com"})

    user_id, email = asyncio.run(auth._resolve_claims("fallback-token"))

    assert user_id == "user-456"
    assert email == "user@example.com"


def test_resolve_claims_rejects_subject_mismatch_on_fallback(monkeypatch):
    async def fake_decode_with_jwks(token: str):
        raise InvalidTokenError("no matching signing key")

    async def fake_fetch_user(token: str):
        return {"id": "user-999", "email": "user@example.com"}

    monkeypatch.setattr(auth, "_decode_with_jwks", fake_decode_with_jwks)
    monkeypatch.setattr(auth, "_fetch_user_with_supabase", fake_fetch_user)
    monkeypatch.setattr(auth, "_decode_unverified", lambda token: {"sub": "user-456"})

    with pytest.raises(AppError) as exc_info:
        asyncio.run(auth._resolve_claims("fallback-token"))

    assert exc_info.value.code == "UNAUTHORIZED"
    assert exc_info.value.message == "Token subject mismatch."


def test_get_auth_context_rejects_missing_authorization_header():
    with pytest.raises(AppError) as exc_info:
        asyncio.run(auth.get_auth_context(None))

    assert exc_info.value.code == "UNAUTHORIZED"
    assert exc_info.value.message == "Missing Authorization header."
