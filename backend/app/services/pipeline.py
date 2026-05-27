import logging

import httpx
from fastapi import BackgroundTasks

from app.config import settings
from app.errors import AppError
from app.services.rationale_worker import run_rationale_worker

log = logging.getLogger(__name__)

_WORKER_NAMES = ("embedding-worker", "match-worker")
_TRIGGER_TIMEOUT_SECONDS = 15.0

def _worker_url(worker_name: str) -> str:
    return f"{settings.normalized_supabase_url}/functions/v1/{worker_name}"


def _worker_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
        "Content-Type": "application/json",
    }


async def _invoke_worker(worker_name: str, client: httpx.AsyncClient) -> dict:
    try:
        response = await client.post(_worker_url(worker_name), headers=_worker_headers(), json={})
    except httpx.HTTPError as exc:
        raise AppError(
            code="PIPELINE_UNAVAILABLE",
            message=f"Unable to trigger {worker_name}.",
            status_code=503,
        ) from exc

    if response.status_code >= 400:
        raise AppError(
            code="PIPELINE_UNAVAILABLE",
            message=f"{worker_name} returned status {response.status_code}. Verify Supabase URL/service-role key.",
            status_code=503,
        )
        
    return response.json()


async def run_pipeline_once() -> None:
    async with httpx.AsyncClient(timeout=_TRIGGER_TIMEOUT_SECONDS) as client:
        # Drain embedding worker queue
        for _ in range(10): # max 10 iterations to prevent infinite loop
            resp = await _invoke_worker("embedding-worker", client)
            if not resp or resp.get("processed", 0) == 0:
                break
                
        # Drain match worker queue
        for _ in range(10):
            resp = await _invoke_worker("match-worker", client)
            if not resp or (resp.get("new_discovered", 0) == 0 and resp.get("stale_updated", 0) == 0):
                break

    # After scoring is refreshed, generate any missing rationales
    try:
        written = await run_rationale_worker()
        log.info("pipeline: rationale_worker wrote %d rationale(s)", written)
    except Exception:
        log.exception("pipeline: rationale_worker failed (non-fatal)")



async def run_pipeline_safely() -> None:
    try:
        await run_pipeline_once()
    except AppError as exc:
        log.warning("Pipeline trigger failed: %s", exc.message)
    except Exception:
        log.exception("Unexpected pipeline trigger failure")


def enqueue_pipeline_run(background_tasks: BackgroundTasks) -> None:
    background_tasks.add_task(run_pipeline_safely)

