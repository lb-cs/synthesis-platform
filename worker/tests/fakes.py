import html
import threading
from collections.abc import Callable

import pymupdf

from worker.chunking import Chunk
from worker.db import ClaimedSource
from worker.web import WebPage


def make_source(number: int, kind: str = 'text') -> ClaimedSource:
    extension = 'pdf' if kind == 'pdf' else 'txt'
    path = f'user-1/project-1/file-{number}.{extension}'

    return ClaimedSource(
        id=f'source-{number}',
        project_id='project-1',
        kind=kind,
        # A link has no file in the bucket, and a file has no url.
        storage_path=None if kind == 'link' else path,
        url=f'https://example.com/article-{number}' if kind == 'link' else None,
    )


class FakeQueue:
    """In-memory SourcesQueue: hands out each pending source once, records results."""

    def __init__(self, pending: list[ClaimedSource]) -> None:
        self._lock = threading.Lock()
        self.pending = list(pending)
        self.claim_sizes: list[int] = []
        self.ready: list[str] = []
        self.failed: dict[str, str] = {}
        self.saved: dict[str, tuple[dict[str, str | int], list[Chunk]]] = {}
        self.save_error: Exception | None = None
        # What happened, in order, so a test can check chunks are saved before `ready`.
        self.events: list[str] = []
        self.is_still_held = True

    def claim(self, max_count: int) -> list[ClaimedSource]:
        with self._lock:
            self.claim_sizes.append(max_count)
            batch, self.pending = self.pending[:max_count], self.pending[max_count:]
            return batch

    def fail_stale(self, stale_after_minutes: int) -> int:
        return 0

    def save_results(
        self, source: ClaimedSource, metadata: dict[str, str | int], chunks: list[Chunk]
    ) -> None:
        with self._lock:
            if self.save_error is not None:
                raise self.save_error

            self.saved[source.id] = (metadata, chunks)
            self.events.append(f'saved {source.id}')

    def mark_ready(self, source_id: str) -> bool:
        with self._lock:
            self.ready.append(source_id)
            self.events.append(f'ready {source_id}')
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
            return b'Hello world.'

        return self._download(storage_path)


class FakePages:
    def __init__(self, fetch: Callable[[str], WebPage] | None = None) -> None:
        self._fetch = fetch

    def fetch(self, url: str) -> WebPage:
        if self._fetch is None:
            return WebPage(url=url, title='An article', text='Hello from the web.')

        return self._fetch(url)


def make_pdf(
    page_texts: list[str],
    metadata: dict[str, str] | None = None,
    password: str | None = None,
) -> bytes:
    document = pymupdf.open()

    for text in page_texts:
        page = document.new_page()

        if text:
            page.insert_text((72, 72), text)

    if metadata:
        document.set_metadata(metadata)

    if password:
        return document.tobytes(
            encryption=pymupdf.PDF_ENCRYPT_AES_256,
            user_pw=password,
            owner_pw=password + '-owner',
        )

    return document.tobytes()


def make_paragraph_pdf(paragraphs: list[str]) -> bytes:
    """One page laid out like a real document: a narrow column, so every paragraph
    wraps over several lines."""
    document = pymupdf.open()
    page = document.new_page()
    body = ''.join(f'<p>{html.escape(paragraph)}</p>' for paragraph in paragraphs)
    page.insert_htmlbox(pymupdf.Rect(50, 50, 300, 800), body)

    return document.tobytes()
