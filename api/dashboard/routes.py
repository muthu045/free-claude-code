"""Dashboard API routes."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from loguru import logger

from api.dashboard.metrics import MetricsCollector

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

_metrics_collector: MetricsCollector | None = None


def get_metrics_collector() -> MetricsCollector:
    """Get or create metrics collector."""
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector()
    return _metrics_collector


async def verify_admin_token(token: str = Query(None)) -> str:
    """Verify admin token for dashboard access."""
    if token != "freecc":
        raise HTTPException(status_code=401, detail="Invalid admin token")
    return token


@router.get("/health")
async def dashboard_health() -> dict[str, Any]:
    """Health check endpoint."""
    return {"status": "healthy", "dashboard": "ready"}


@router.get("/metrics")
async def get_metrics(
    limit: int = Query(100, ge=1, le=1000),
    provider: str | None = Query(None),
    token: str = Depends(verify_admin_token),
    collector: MetricsCollector = Depends(get_metrics_collector),
) -> dict[str, Any]:
    """Get recent metrics."""
    return {
        "metrics": collector.get_metrics(limit=limit, provider=provider),
        "count": min(limit, len(collector.metrics)),
    }


@router.get("/providers")
async def get_providers(
    token: str = Depends(verify_admin_token),
    collector: MetricsCollector = Depends(get_metrics_collector),
) -> dict[str, Any]:
    """Get provider health status."""
    return {"providers": collector.get_provider_status()}


@router.get("/stats")
async def get_stats(
    provider: str | None = Query(None),
    duration_s: int = Query(3600, ge=60, le=86400),
    token: str = Depends(verify_admin_token),
    collector: MetricsCollector = Depends(get_metrics_collector),
) -> dict[str, Any]:
    """Get aggregated statistics."""
    return collector.get_stats(provider=provider, duration_s=duration_s)


@router.get("/data")
async def get_dashboard_data(
    token: str = Depends(verify_admin_token),
    collector: MetricsCollector = Depends(get_metrics_collector),
) -> dict[str, Any]:
    """Get complete dashboard snapshot."""
    return collector.get_dashboard_data()


@router.websocket("/ws/metrics")
async def websocket_metrics(websocket: WebSocket) -> None:
    """WebSocket endpoint for real-time metrics streaming."""
    await websocket.accept()
    collector = get_metrics_collector()

    try:
        while True:
            data = collector.get_dashboard_data()
            await websocket.send_json(data)

            try:
                message = await asyncio.wait_for(
                    websocket.receive_text(), timeout=2.0
                )
                if message == "close":
                    break
            except asyncio.TimeoutError:
                continue
    except WebSocketDisconnect:
        logger.debug("Dashboard WebSocket client disconnected")
    except Exception as exc:
        logger.error(f"WebSocket error: {exc}")
        await websocket.close(code=1011)
