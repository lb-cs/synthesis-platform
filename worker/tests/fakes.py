import threading
from collections.abc import Callable

from worker.db import ClaimedSource


def make_source(number: int) -> ClaimedSource:
    return ClaimedSource(
        id=f'source-{number}',
        project_id='project-1',
        kind='pdf',
        storage_path=f'user-1/project-1/file-{number}.pdf',
    )


class FakeQueue:
    """In-memory SourcesQueue: hands out each pending source once, records results."""

    def __init__(self, pending: list[ClaimedSource]) -> None:
        self._lock = threading.Lock()
        self.pending = list(pending)
        self.claim_sizes: list[int] = []
        self.ready: list[str] = []
        self.failed: dict[str, str] = {}
        self.is_still_held = True

    def claim(self, max_count: int) -> list[ClaimedSource]:
        with self._lock:
            self.claim_sizes.append(max_count)
            batch, self.pending = self.pending[:max_count], self.pending[max_count:]
            return batch

    def fail_stale(self, stale_after_minutes: int) -> int:
        return 0

    def mark_ready(self, source_id: str) -> bool:
        with self._lock:
            self.ready.append(source_id)
            return self.is_still_held

    def mark_failed(self, source_id: str, message: str) -> bool:
        with self._lock:
            self.failed[source_id] = message
            return self.is_still_held

    def finished_count(self) -> int:
        with self._lock:
            return len(self.ready) + len(self.failed)


class FakeFiles:
    def __init__(self, download: Callable[[str], bytes] | None = None) -> None:
        self._download = download

    def download(self, storage_path: str) -> bytes:
        if self._download is None:
            return b'%PDF-1.7 hello'

        return self._download(storage_path)
