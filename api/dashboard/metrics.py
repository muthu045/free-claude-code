"""Real-time metrics collection and aggregation for dashboard."""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field, asdict
from datetime import datetime
from threading import Lock
from typing import Any

from loguru import logger


@dataclass
class RequestMetric:
    """Single request metric record."""

    timestamp: float
    provider: str
    model: str
    endpoint: str
    method: str
    status_code: int
    duration_ms: float
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    error: str | None = None
    cache_hit: bool = False

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)


@dataclass
class ProviderStatus:
    """Provider health and performance stats."""

    name: str
    is_healthy: bool = True
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    avg_latency_ms: float = 0.0
    error_rate: float = 0.0
    last_error: str | None = None
    last_check: float = field(default_factory=time.time)
    uptime_percent: float = 100.0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)


class MetricsCollector:
    """Thread-safe metrics collection and retrieval."""

    def __init__(self, max_records: int = 10000):
        """Initialize collector.

        Args:
            max_records: Maximum number of records to keep in memory
        """
        self.max_records = max_records
        self.metrics: deque[RequestMetric] = deque(maxlen=max_records)
        self.provider_stats: dict[str, ProviderStatus] = {}
        self.lock = Lock()
        self.session_start = time.time()

    def record_request(
        self,
        provider: str,
        model: str,
        endpoint: str,
        method: str,
        status_code: int,
        duration_ms: float,
        input_tokens: int = 0,
        output_tokens: int = 0,
        error: str | None = None,
        cache_hit: bool = False,
    ) -> None:
        """Record a single request metric."""
        with self.lock:
            metric = RequestMetric(
                timestamp=time.time(),
                provider=provider,
                model=model,
                endpoint=endpoint,
                method=method,
                status_code=status_code,
                duration_ms=duration_ms,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=input_tokens + output_tokens,
                error=error,
                cache_hit=cache_hit,
            )
            self.metrics.append(metric)
            self._update_provider_stats(provider, status_code, error)
            logger.debug(
                f"Recorded metric: {provider}/{model} {endpoint} {status_code} {duration_ms}ms"
            )

    def _update_provider_stats(
        self, provider: str, status_code: int, error: str | None
    ) -> None:
        """Update provider statistics."""
        if provider not in self.provider_stats:
            self.provider_stats[provider] = ProviderStatus(name=provider)

        stats = self.provider_stats[provider]
        stats.total_requests += 1
        stats.last_check = time.time()

        if 200 <= status_code < 300:
            stats.successful_requests += 1
            stats.is_healthy = True
        else:
            stats.failed_requests += 1
            if error:
                stats.last_error = error

        if stats.total_requests > 0:
            stats.error_rate = stats.failed_requests / stats.total_requests

    def get_metrics(
        self,
        limit: int = 100,
        provider: str | None = None,
        start_time: float | None = None,
    ) -> list[dict[str, Any]]:
        """Get recent metrics, optionally filtered."""
        with self.lock:
            metrics = list(self.metrics)

        if provider:
            metrics = [m for m in metrics if m.provider == provider]

        if start_time:
            metrics = [m for m in metrics if m.timestamp >= start_time]

        return [m.to_dict() for m in metrics[-limit:]]

    def get_provider_status(self, provider: str | None = None) -> dict[str, Any]:
        """Get provider health status."""
        with self.lock:
            if provider:
                if provider in self.provider_stats:
                    return self.provider_stats[provider].to_dict()
                return {}
            return {
                name: stats.to_dict() for name, stats in self.provider_stats.items()
            }

    def get_stats(
        self,
        provider: str | None = None,
        duration_s: int = 3600,
    ) -> dict[str, Any]:
        """Get aggregated statistics."""
        cutoff_time = time.time() - duration_s
        metrics = self.get_metrics(limit=self.max_records, start_time=cutoff_time)

        if provider:
            metrics = [m for m in metrics if m["provider"] == provider]

        if not metrics:
            return {
                "total_requests": 0,
                "successful_requests": 0,
                "failed_requests": 0,
                "avg_latency_ms": 0.0,
                "total_tokens": 0,
                "cache_hits": 0,
            }

        successful = sum(1 for m in metrics if 200 <= m["status_code"] < 300)
        failed = len(metrics) - successful
        avg_latency = sum(m["duration_ms"] for m in metrics) / len(metrics)
        total_tokens = sum(m["total_tokens"] for m in metrics)
        cache_hits = sum(1 for m in metrics if m["cache_hit"])

        return {
            "total_requests": len(metrics),
            "successful_requests": successful,
            "failed_requests": failed,
            "avg_latency_ms": round(avg_latency, 2),
            "total_tokens": total_tokens,
            "cache_hits": cache_hits,
            "uptime_percent": (successful / len(metrics) * 100) if metrics else 0,
        }

    def get_dashboard_data(self) -> dict[str, Any]:
        """Get complete dashboard data snapshot."""
        with self.lock:
            uptime = time.time() - self.session_start
            total_metrics = len(self.metrics)

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "uptime_seconds": int(uptime),
            "total_requests": total_metrics,
            "providers": self.get_provider_status(),
            "stats": self.get_stats(),
            "recent_metrics": self.get_metrics(limit=50),
        }
