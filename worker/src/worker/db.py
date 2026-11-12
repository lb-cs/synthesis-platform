"""
Every query the worker makes against public.sources and public.document_chunks. The
service role bypasses RLS, so each write filters on id and status itself instead of
relying on a policy.
"""

from dataclasses import dataclass
from typing import Any

import httpx
from supabase import Client, ClientOptions, create_client

from worker.chunking import Chunk

# supabase-py's own default for database requests.
SUPABASE_TIMEOUT_SECONDS = 120.0

# Rows per insert. 100 chunks of up to 1,000 characters is about 100 KB a request.
CHUNK_INSERT_BATCH_SIZE = 100


@dataclass(frozen=True)
class ClaimedSource:
    id: str
    project_id: str
    kind: str
    # Null for a link: it points at a web page and has no file in the bucket.
    storage_path: str | None
    # The page a link points at. Null for a file.
    url: str | None


def to_claimed_source(row: dict[str, Any]) -> ClaimedSource:
    # Read by name, not ClaimedSource(**row): the migration and the worker deploy at
    # different moments, so a claim may return a column this worker doesn't know yet, or
    # lack `url`. Raising here would strand rows the claim already marked 'processing'.
    return ClaimedSource(
        id=row['id'],
        project_id=row['project_id'],
        kind=row['kind'],
        storage_path=row['storage_path'],
        url=row.get('url'),
    )


def create_worker_client(
    supabase_url: str,
    service_role_key: str,
    transport: httpx.BaseTransport | None = None,
) -> Client:
    """The Supabase client every thread shares, over HTTP/1.1.

    supabase-py defaults to HTTP/2, which sends every thread's requests down one
    connection. httpx's sync HTTP/2 connection is not safe to read from several threads
    at once: the polling thread and a source thread collided, both requests died with
    `ReadError: [Errno 11]`, and the source failed. Over HTTP/1.1 each request in flight
    takes its own pooled connection, so threads never share a socket. `transport` is for
    tests.
    """
    http_client = httpx.Client(
        http2=False,
        follow_redirects=True,
        timeout=SUPABASE_TIMEOUT_SECONDS,
        transport=transport,
    )

    return create_client(
        supabase_url, service_role_key, options=ClientOptions(httpx_client=http_client)
    )


class SourcesQueue:
    """sources.status is the queue: pending → processing → ready | failed."""

    def __init__(self, client: Client) -> None:
        self._client = client

    def claim(self, max_count: int) -> list[ClaimedSource]:
        response = self._client.rpc(
            'claim_pending_sources', {'max_count': max_count}
        ).execute()

        return [to_claimed_source(row) for row in response.data]

    def fail_stale(self, stale_after_minutes: int) -> int:
        response = self._client.rpc(
            'fail_stale_sources', {'stale_after_minutes': stale_after_minutes}
        ).execute()

        return response.data

    def save_results(
        self, source: ClaimedSource, metadata: dict[str, str | int], chunks: list[Chunk]
    ) -> None:
        """Writes the parsed details and chunks. Safe to run again for the same source."""
        # A retried source may still have chunks from an attempt that died partway, and
        # (source_id, chunk_index) is unique. Clearing first makes a retry start clean.
        self._client.table('document_chunks').delete().eq(
            'source_id', source.id
        ).execute()

        rows = [
            {
                'source_id': source.id,
                'project_id': source.project_id,
                'chunk_index': chunk.chunk_index,
                'content': chunk.content,
                'page_number': chunk.page_number,
                'embedding': chunk.embedding,
            }
            for chunk in chunks
        ]

        for start in range(0, len(rows), CHUNK_INSERT_BATCH_SIZE):
            batch = rows[start : start + CHUNK_INSERT_BATCH_SIZE]
            self._client.table('document_chunks').insert(batch).execute()

        # Same guard as _finish: only touch a row this worker still holds.
        (
            self._client.table('sources')
            .update({'metadata': metadata})
            .eq('id', source.id)
            .eq('status', 'processing')
            .execute()
        )

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
