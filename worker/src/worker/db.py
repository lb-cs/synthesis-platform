"""
Every query the worker makes against public.sources. The service role bypasses RLS, so
each write filters on id and status itself instead of relying on a policy.
"""

from dataclasses import dataclass

from supabase import Client


@dataclass(frozen=True)
class ClaimedSource:
    id: str
    project_id: str
    kind: str
    storage_path: str


class SourcesQueue:
    """sources.status is the queue: pending → processing → ready | failed."""

    def __init__(self, client: Client) -> None:
        self._client = client

    def claim(self, max_count: int) -> list[ClaimedSource]:
        response = self._client.rpc(
            'claim_pending_sources', {'max_count': max_count}
        ).execute()

        return [ClaimedSource(**row) for row in response.data]

    def fail_stale(self, stale_after_minutes: int) -> int:
        response = self._client.rpc(
            'fail_stale_sources', {'stale_after_minutes': stale_after_minutes}
        ).execute()

        return response.data

    def mark_ready(self, source_id: str) -> bool:
        return self._finish(source_id, {'status': 'ready', 'processing_error': None})

    def mark_failed(self, source_id: str, message: str) -> bool:
        return self._finish(source_id, {'status': 'failed', 'processing_error': message})

    def _finish(self, source_id: str, changes: dict[str, str | None]) -> bool:
        # Only move a row this worker still holds. False means it was deleted or timed
        # out (fail_stale) while we worked; leave it alone.
        response = (
            self._client.table('sources')
            .update(changes)
            .eq('id', source_id)
            .eq('status', 'processing')
            .execute()
        )

        return len(response.data) > 0
