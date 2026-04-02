import asyncio
from dataclasses import dataclass
from typing import Any, Optional

import httpx
import jwt
from fastapi import Header
from jwt import InvalidTokenError, PyJWKClient, PyJWKClientError

from app.config import settings
from app.errors import AppError


@dataclass(frozen=True)
class AuthContext:
    user_id: str
    email: Optional[str]
    token: str


_jwks_client: PyJWKClient | None = None
_ALLOWED_JWT_ALGORITHMS = ["RS256", "ES256", "EdDSA"]


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(settings.supabase_jwks_url)
    return _jwks_client


async def _decode_with_jwks(token: str) -> dict[str, Any]:
    signing_key = await asyncio.to_thread(_get_jwks_client().get_signing_key_from_jwt, token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=_ALLOWED_JWT_ALGORITHMS,
        issuer=f"{settings.normalized_supabase_url}/auth/v1",
        options={"verify_aud": False},
    )


def _decode_unverified(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            options={
                "verify_signature": False,
                "verify_exp": False,
                "verify_aud": False,
                "verify_iss": False,
            },
        )
    except InvalidTokenError as exc:
        raise AppError(code="UNAUTHORIZED", message="Invalid or expired token.", status_code=401) from exc


async def _fetch_user_with_supabase(token: str) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": settings.supabase_anon_key,
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(settings.supabase_auth_user_url, headers=headers)
    except httpx.HTTPError as exc:
        raise AppError(code="AUTH_UNAVAILABLE", message="Unable to verify token right now.", status_code=503) from exc

    if response.status_code != 200:
        raise AppError(code="UNAUTHORIZED", message="Invalid or expired token.", status_code=401)

    return response.json()


async def _resolve_claims(token: str) -> tuple[str, Optional[str]]:
    try:
        payload = await _decode_with_jwks(token)
        user_id = payload.get("sub")
        if not user_id:
            raise AppError(code="UNAUTHORIZED", message="Missing sub claim.", status_code=401)
        return user_id, payload.get("email")
    except (InvalidTokenError, PyJWKClientError, httpx.HTTPError):
        user = await _fetch_user_with_supabase(token)
        payload = _decode_unverified(token)
        user_id = payload.get("sub")
        if not user_id:
            raise AppError(code="UNAUTHORIZED", message="Missing sub claim.", status_code=401)
        if str(user.get("id")) != str(user_id):
            raise AppError(code="UNAUTHORIZED", message="Token subject mismatch.", status_code=401)
        return user_id, user.get("email") or payload.get("email")


async def get_auth_context(authorization: str | None = Header(default=None)) -> AuthContext:
    if not authorization:
        raise AppError(code="UNAUTHORIZED", message="Missing Authorization header.", status_code=401)

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise AppError(code="UNAUTHORIZED", message="Invalid auth scheme.", status_code=401)

    user_id, email = await _resolve_claims(token)
    return AuthContext(user_id=user_id, email=email, token=token)
