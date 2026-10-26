"""
Runs the claim functions in supabase/migrations against the local database, with real
row locks. Needs `supabase start`; skipped when the database is not reachable. Nothing
is left behind: claims roll back and the seeded user is deleted (rows cascade).
"""

import math
import os
import threading
import uuid
from collections.abc import Iterator

import psycopg
import pytest
from psycopg import sql

pytestmark = pytest.mark.integration

DATABASE_URL = os.environ.get(
    'WORKER_TEST_DATABASE_URL', 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
)
SEEDED_SOURCES = 40
WORKERS = 8


def connect() -> psycopg.Connection:
    return psycopg.connect(DATABASE_URL, connect_timeout=3)


@pytest.fixture(scope='module')
def seeded() -> Iterator[list[str]]:
    try:
        setup = connect()
    except psycopg.OperationalError:
        pytest.skip('local Supabase database is not running (supabase start)')

    user_id = uuid.uuid4()

    with setup, setup.cursor() as cur:
        cur.execute(
            'insert into auth.users (id, email) values (%s, %s)',
            (user_id, f'worker-test-{user_id}@example.com'),
        )
        cur.execute(
            "insert into public.projects (user_id, title) values (%s, 'Worker test')"
            ' returning id',
            (user_id,),
        )
        project_id = cur.fetchone()[0]
        cur.execute(
            'insert into public.sources (project_id, kind, title, storage_path)'
            " select %s, 'text', 'Source ' || n, %s || n || '.txt'"
            ' from generate_series(1, %s) n returning id',
            (project_id, f'{user_id}/{project_id}/', SEEDED_SOURCES),
        )
        source_ids = [str(row[0]) for row in cur.fetchall()]

    yield source_ids

    with connect() as teardown, teardown.cursor() as cur:
        cur.execute('delete from auth.users where id = %s', (user_id,))


def claim_as_worker(
    max_count: int, barrier: threading.Barrier, results: list[list[str]]
) -> None:
    # Hold the transaction open until every worker has claimed, so all claims overlap.
    with connect() as conn, conn.cursor() as cur:
        cur.execute('set role service_role')
        cur.execute('select id from public.claim_pending_sources(%s)', (max_count,))
        results.append([str(row[0]) for row in cur.fetchall()])
        barrier.wait()
        conn.rollback()


def test_concurrent_workers_never_claim_the_same_source(seeded: list[str]):
    with connect() as conn, conn.cursor() as cur:
        cur.execute("select count(*) from public.sources where status = 'pending'")
        pending = cur.fetchone()[0]

    # Enough per worker that, together, they take every pending row.
    max_count = math.ceil(pending / WORKERS) + 1
    barrier = threading.Barrier(WORKERS, timeout=10)
    results: list[list[str]] = []
    threads = [
        threading.Thread(target=claim_as_worker, args=(max_count, barrier, results))
        for _ in range(WORKERS)
    ]

    for thread in threads:
        thread.start()

    for thread in threads:
        thread.join()

    claimed = [source_id for batch in results for source_id in batch]

    assert len(results) == WORKERS
    assert len(claimed) == len(set(claimed)), 'a source was claimed twice'
    assert set(seeded) <= set(claimed)
    assert sum(1 for batch in results if batch) > 1


def test_a_claim_marks_the_source_processing(seeded: list[str]):
    with connect() as conn, conn.cursor() as cur:
        cur.execute('set role service_role')
        cur.execute('select id from public.claim_pending_sources(1)')
        source_id = cur.fetchone()[0]
        cur.execute(
            'select status, processing_started_at is not null from public.sources'
            ' where id = %s',
            (source_id,),
        )

        assert cur.fetchone() == ('processing', True)
        conn.rollback()


def test_stale_processing_sources_fail_and_fresh_ones_do_not(seeded: list[str]):
    stale_id, fresh_id = seeded[0], seeded[1]

    with connect() as conn, conn.cursor() as cur:
        cur.execute(
            "update public.sources set status = 'processing',"
            " processing_started_at = now() - interval '20 minutes' where id = %s",
            (stale_id,),
        )
        cur.execute(
            "update public.sources set status = 'processing',"
            " processing_started_at = now() - interval '1 minute' where id = %s",
            (fresh_id,),
        )
        cur.execute('set role service_role')
        cur.execute('select public.fail_stale_sources(15)')
        cur.execute(
            'select id::text, status, processing_error from public.sources'
            ' where id in (%s, %s)',
            (stale_id, fresh_id),
        )
        rows = {row[0]: row[1:] for row in cur.fetchall()}

        assert rows[stale_id][0] == 'failed'
        assert rows[stale_id][1]
        assert rows[fresh_id] == ('processing', None)
        conn.rollback()


@pytest.mark.parametrize('role', ['anon', 'authenticated'])
@pytest.mark.parametrize('function', ['claim_pending_sources', 'fail_stale_sources'])
def test_only_the_service_role_can_run_the_queue_functions(
    seeded: list[str], role: str, function: str
):
    with connect() as conn, conn.cursor() as cur:
        cur.execute(sql.SQL('set role {}').format(sql.Identifier(role)))

        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            cur.execute(sql.SQL('select public.{}()').format(sql.Identifier(function)))
