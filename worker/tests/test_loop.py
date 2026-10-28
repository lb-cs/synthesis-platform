import threading
import time

from tests.fakes import FakeFiles, FakeQueue, make_source
from worker.config import Config
from worker.embeddings import EMBEDDING_DIMENSIONS
from worker.loop import run

CONFIG = Config(
    supabase_url='http://127.0.0.1:54321',
    service_role_key='test',
    openai_api_key='sk-test',
    concurrency=3,
    poll_interval_seconds=1,
)


class FakeEmbedder:
    def embed(self, texts):
        vector = '[' + ','.join(['0.1'] * EMBEDDING_DIMENSIONS) + ']'
        return [vector for _ in texts]


def start_loop(
    queue: FakeQueue, files: FakeFiles
) -> tuple[threading.Thread, threading.Event]:
    stop = threading.Event()
    thread = threading.Thread(
        target=run, args=(queue, files, FakeEmbedder(), CONFIG, stop), daemon=True
    )
    thread.start()

    return thread, stop


def wait_until(condition, timeout: float = 5) -> bool:
    deadline = time.monotonic() + timeout

    while time.monotonic() < deadline:
        if condition():
            return True

        time.sleep(0.01)

    return False


def test_processes_up_to_concurrency_sources_at_the_same_time():
    # Every download waits for the other two; run serially, the barrier times out.
    barrier = threading.Barrier(3, timeout=3)

    def download_together(_: str) -> bytes:
        barrier.wait()
        return b'text'

    queue = FakeQueue([make_source(n) for n in range(3)])
    thread, stop = start_loop(queue, FakeFiles(download_together))

    assert wait_until(lambda: queue.finished_count() == 3)
    stop.set()
    thread.join(timeout=5)

    assert sorted(queue.ready) == ['source-0', 'source-1', 'source-2']


def test_never_claims_more_than_the_free_slots():
    release = threading.Event()

    def slow_download(_: str) -> bytes:
        release.wait(timeout=5)
        return b'text'

    queue = FakeQueue([make_source(n) for n in range(7)])
    thread, stop = start_loop(queue, FakeFiles(slow_download))

    time.sleep(0.2)
    release.set()
    assert wait_until(lambda: queue.finished_count() == 7)
    stop.set()
    thread.join(timeout=5)

    assert max(queue.claim_sizes) <= CONFIG.concurrency
    assert queue.claim_sizes[0] == CONFIG.concurrency


def test_stopping_lets_in_flight_sources_finish():
    started = threading.Event()

    def slow_download(_: str) -> bytes:
        started.set()
        time.sleep(0.3)
        return b'text'

    queue = FakeQueue([make_source(1)])
    thread, stop = start_loop(queue, FakeFiles(slow_download))

    assert started.wait(timeout=5)
    stop.set()
    thread.join(timeout=5)

    assert queue.ready == ['source-1']


def test_a_failed_claim_does_not_stop_the_worker():
    queue = FakeQueue([make_source(1)])
    real_claim = queue.claim
    calls = {'count': 0}

    def flaky_claim(max_count: int):
        calls['count'] += 1

        if calls['count'] == 1:
            raise ConnectionError('database unreachable')

        return real_claim(max_count)

    queue.claim = flaky_claim
    thread, stop = start_loop(queue, FakeFiles())

    assert wait_until(lambda: queue.ready == ['source-1'])
    stop.set()
    thread.join(timeout=5)
