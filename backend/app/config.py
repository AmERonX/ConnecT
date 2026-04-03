import os
from dataclasses import dataclass
from pathlib import Path
from typing import List

from dotenv import load_dotenv

env_root = Path(__file__).resolve().parent.parent
load_dotenv(env_root / ".env")
load_dotenv(env_root / ".env.local", override=True)


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    cohere_api_key: str
    supabase_db_url: str
    supabase_service_db_url: str
    api_port: int
    cors_origins: List[str]
    db_pool_min_size: int
    db_pool_max_size: int
    db_service_pool_min_size: int
    db_service_pool_max_size: int
    db_pool_acquire_timeout: float
    db_statement_cache_size: int
    llm_model: str = "command-r-08-2024"
    embedding_model: str = "embed-english-v3.0"
    temperature: int = 0
    max_tokens: int = 500
    input_type: str = "search_document"

    @property
    def normalized_supabase_url(self) -> str:
        return self.supabase_url.rstrip("/")

    @property
    def supabase_jwks_url(self) -> str:
        return f"{self.normalized_supabase_url}/auth/v1/.well-known/jwks.json"

    @property
    def supabase_auth_user_url(self) -> str:
        return f"{self.normalized_supabase_url}/auth/v1/user"


def _env(name: str, default: str) -> str:
    return os.getenv(name, default)


def load_settings() -> Settings:
    cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:5500,http://localhost:3000")
    supabase_db_url = _env("SUPABASE_DB_URL", "postgresql://postgres:postgres@localhost:5432/postgres")
    service_db_url = os.getenv("SUPABASE_SERVICE_DB_URL", supabase_db_url)

    return Settings(
        supabase_url=_env("SUPABASE_URL", "https://your-project.supabase.co"),
        supabase_anon_key=_env("SUPABASE_ANON_KEY", "your-anon-key"),
        supabase_service_role_key=_env("SUPABASE_SERVICE_ROLE_KEY", "your-service-role-key"),
        cohere_api_key=_env("COHERE_API_KEY", "your-cohere-api-key"),
        supabase_db_url=supabase_db_url,
        supabase_service_db_url=service_db_url,
        api_port=int(os.getenv("API_PORT", "8000")),
        cors_origins=[item.strip() for item in cors_raw.split(",") if item.strip()],
        db_pool_min_size=int(os.getenv("DB_POOL_MIN_SIZE", "0")),
        db_pool_max_size=int(os.getenv("DB_POOL_MAX_SIZE", "4")),
        db_service_pool_min_size=int(os.getenv("DB_SERVICE_POOL_MIN_SIZE", "0")),
        db_service_pool_max_size=int(os.getenv("DB_SERVICE_POOL_MAX_SIZE", "2")),
        db_pool_acquire_timeout=float(os.getenv("DB_POOL_ACQUIRE_TIMEOUT", "5")),
        db_statement_cache_size=int(os.getenv("DB_STATEMENT_CACHE_SIZE", "0")),
    )


settings = load_settings()


config = {
    "llm_model": settings.llm_model,
    "embedding_model": settings.embedding_model,
    "temperature": settings.temperature,
    "max_tokens": settings.max_tokens,
    "input_type": settings.input_type,
}


def get_api_key() -> str:
    key = settings.cohere_api_key
    if not key:
        raise EnvironmentError("COHERE_API_KEY environment variable is not set")
    return key
