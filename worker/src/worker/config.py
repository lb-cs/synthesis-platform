import os
from collections.abc import Mapping
from dataclasses import dataclass

DEFAULT_CONCURRENCY = 4
DEFAULT_POLL_INTERVAL_SECONDS = 5
DEFAULT_STALE_AFTER_MINUTES = 15


class ConfigError(Exception):
    """The environment is missing or has an invalid setting."""


@dataclass(frozen=True)
class Config:
    supabase_url: str
    service_role_key: str
    ai_gateway_api_key: str
    concurrency: int = DEFAULT_CONCURRENCY
    poll_interval_seconds: int = DEFAULT_POLL_INTERVAL_SECONDS
    stale_after_minutes: int = DEFAULT_STALE_AFTER_MINUTES


def load_config(env: Mapping[str, str] = os.environ) -> Config:
    supabase_url = env.get('SUPABASE_URL', '').strip()
    service_role_key = env.get('SUPABASE_SERVICE_ROLE_KEY', '').strip()
    ai_gateway_api_key = env.get('AI_GATEWAY_API_KEY', '').strip()

    if not supabase_url or not service_role_key or not ai_gateway_api_key:
        raise ConfigError(
            'SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and AI_GATEWAY_API_KEY '
            'must be set. Copy worker/.env.example to worker/.env and fill them in.'
        )

    return Config(
        supabase_url=supabase_url,
        service_role_key=service_role_key,
        ai_gateway_api_key=ai_gateway_api_key,
        concurrency=read_positive_int(env, 'WORKER_CONCURRENCY', DEFAULT_CONCURRENCY),
        poll_interval_seconds=read_positive_int(
            env, 'WORKER_POLL_INTERVAL_SECONDS', DEFAULT_POLL_INTERVAL_SECONDS
        ),
        stale_after_minutes=read_positive_int(
            env, 'WORKER_STALE_AFTER_MINUTES', DEFAULT_STALE_AFTER_MINUTES
        ),
    )


def read_positive_int(env: Mapping[str, str], name: str, default: int) -> int:
    raw = env.get(name, '').strip()

    if not raw:
        return default

    if not raw.isdigit() or int(raw) < 1:
        raise ConfigError(f'{name} must be a whole number of at least 1, got {raw!r}.')

    return int(raw)
