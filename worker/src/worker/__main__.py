"""Entry point: `uv run python -m worker` from the worker/ folder."""

import logging
import signal
import sys
import threading

from dotenv import find_dotenv, load_dotenv
from supabase import create_client

from worker.config import ConfigError, load_config
from worker.db import SourcesQueue
from worker.loop import run
from worker.storage import SourceFiles

log = logging.getLogger('worker')


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s %(levelname)-7s [%(threadName)s] %(message)s',
    )
    # supabase-py's HTTP client logs every request at INFO.
    logging.getLogger('httpx').setLevel(logging.WARNING)
    # Real environment variables win over the file, so hosting can set them directly.
    load_dotenv(find_dotenv(usecwd=True))

    try:
        config = load_config()
    except ConfigError as error:
        log.error('%s', error)
        return 1

    client = create_client(config.supabase_url, config.service_role_key)
    queue = SourcesQueue(client)

    # One harmless call up front, so a wrong URL or key fails here, not on every poll.
    try:
        queue.fail_stale(config.stale_after_minutes)
    except Exception:
        log.exception('could not reach Supabase at %s', config.supabase_url)
        return 1

    stop = threading.Event()
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    signal.signal(signal.SIGTERM, lambda *_: stop.set())

    log.info(
        'worker started: concurrency=%d, poll every %ds',
        config.concurrency,
        config.poll_interval_seconds,
    )
    run(queue, SourceFiles(client), config, stop)
    log.info('worker stopped')

    return 0


if __name__ == '__main__':
    sys.exit(main())
