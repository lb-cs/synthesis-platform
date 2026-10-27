"""
The polling loop. The main thread claims sources; a bounded thread pool processes them,
so up to `concurrency` sources run at once and the web app never waits on any of them.
"""

import logging
import threading
import time
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from typing import Protocol

from supabase import StorageException

from worker import pipeline
from worker.chunking import Chunk
from worker.config import Config
from worker.db import ClaimedSource
from worker.pipeline import ProcessingError

log = logging.getLogger(__name__)

# Written to sources.processing_error, which the sources page shows the user.
DOWNLOAD_FAILED = 'The file could not be read from storage. Try uploading it again.'
UNEXPECTED_FAILURE = 'Processing failed unexpectedly. Try uploading the file again.'

STALE_SWEEP_INTERVAL_SECONDS = 60


class Queue(Protocol):
    def claim(self, max_count: int) -> list[ClaimedSource]: ...
    def fail_stale(self, stale_after_minutes: int) -> int: ...
    def save_results(
        self, source: ClaimedSource, metadata: dict[str, str | int], chunks: list[Chunk]
    ) -> None: ...
    def mark_ready(self, source_id: str) -> bool: ...
    def mark_failed(self, source_id: str, message: str) -> bool: ...


class Files(Protocol):
    def download(self, storage_path: str) -> bytes: ...


def process_source(source: ClaimedSource, queue: Queue, files: Files) -> None:
    """Runs one claimed source to `ready` or `failed`. Never raises for a bad file."""
    failure = run_pipeline(source, queue, files)

    if failure is not None:
        is_updated = queue.mark_failed(source.id, failure)
        log.info('source %s failed: %s', source.id, failure)
    else:
        is_updated = queue.mark_ready(source.id)
        log.info('source %s ready', source.id)

    if not is_updated:
        log.info('source %s was deleted or timed out while processing', source.id)


def run_pipeline(source: ClaimedSource, queue: Queue, files: Files) -> str | None:
    """Returns the user-facing failure message, or None when the source is ready."""
    try:
        file_bytes = files.download(source.storage_path)
        processed = pipeline.process(source, file_bytes)
        queue.save_results(source, processed.metadata, processed.chunks)
    except ProcessingError as error:
        return str(error)
    except StorageException as error:
        log.warning('source %s: download failed: %s', source.id, error)
        return DOWNLOAD_FAILED
    except Exception:
        log.exception('source %s: unexpected error', source.id)
        return UNEXPECTED_FAILURE

    return None


def run(queue: Queue, files: Files, config: Config, stop: threading.Event) -> None:
    """Polls until `stop` is set, then lets in-flight sources finish."""
    in_flight: set[Future[None]] = set()
    last_sweep = 0.0

    with ThreadPoolExecutor(config.concurrency, thread_name_prefix='source') as pool:
        while not stop.is_set():
            in_flight = {future for future in in_flight if not future.done()}

            if time.monotonic() - last_sweep >= STALE_SWEEP_INTERVAL_SECONDS:
                sweep_stale(queue, config)
                last_sweep = time.monotonic()

            free_slots = config.concurrency - len(in_flight)

            if free_slots == 0:
                wait(
                    in_flight,
                    timeout=config.poll_interval_seconds,
                    return_when=FIRST_COMPLETED,
                )
                continue

            claimed = claim(queue, free_slots)

            for source in claimed:
                future = pool.submit(process_source, source, queue, files)
                future.add_done_callback(log_crash)
                in_flight.add(future)

            # A full batch means more may be waiting; otherwise the queue is drained.
            if len(claimed) < free_slots:
                stop.wait(config.poll_interval_seconds)

        log.info('stopping: waiting for %d source(s) to finish', len(in_flight))


def claim(queue: Queue, max_count: int) -> list[ClaimedSource]:
    # A dropped connection shouldn't kill the worker; the next poll tries again.
    try:
        return queue.claim(max_count)
    except Exception:
        log.exception('could not claim sources; retrying next poll')
        return []


def sweep_stale(queue: Queue, config: Config) -> None:
    try:
        count = queue.fail_stale(config.stale_after_minutes)
    except Exception:
        log.exception('could not fail stale sources; retrying later')
        return

    if count > 0:
        log.warning('failed %d source(s) stuck in processing', count)


def log_crash(future: Future[None]) -> None:
    # Only a database error while marking the result lands here; the row stays
    # `processing` until sweep_stale fails it.
    error = future.exception()

    if error is not None:
        log.error('could not record a result', exc_info=error)
