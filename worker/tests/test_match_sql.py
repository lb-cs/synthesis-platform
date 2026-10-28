"""
Runs match_document_chunks in supabase/migrations against the local database. It lives
here because the worker writes the chunks it searches. Needs `supabase start`; skipped
when the database is not reachable. Everything it writes is rolled back.
"""

import os
import uuid

import psycopg
import pytest

pytestmark = pytest.mark.integration

DATABASE_URL = os.environ.get(
    'WORKER_TEST_DATABASE_URL', 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
)
EMBEDDING = '[' + ','.join(['0.1'] * 1536) + ']'


def test_only_chunks_of_ready_sources_are_searched():
    try:
        conn = psycopg.connect(DATABASE_URL, connect_timeout=3)
    except psycopg.OperationalError:
        pytest.skip('local Supabase database is not running (supabase start)')

    user_id = uuid.uuid4()

    with conn, conn.cursor() as cur:
        cur.execute(
            'insert into auth.users (id, email) values (%s, %s)',
            (user_id, f'match-test-{user_id}@example.com'),
        )
        cur.execute(
            "insert into public.projects (user_id, title) values (%s, 'Match test')"
            ' returning id',
            (user_id,),
        )
        project_id = cur.fetchone()[0]

        # One embedded chunk per status; only the ready source's should come back.
        for status in ('pending', 'processing', 'ready', 'failed'):
            cur.execute(
                'insert into public.sources'
                ' (project_id, kind, title, storage_path, status)'
                " values (%s, 'text', %s, %s, %s) returning id",
                (project_id, status, f'{user_id}/{project_id}/{status}.txt', status),
            )
            source_id = cur.fetchone()[0]
            cur.execute(
                'insert into public.document_chunks'
                ' (source_id, project_id, chunk_index, content, embedding)'
                ' values (%s, %s, 0, %s, %s::extensions.vector)',
                (source_id, project_id, f'{status} chunk', EMBEDDING),
            )

        cur.execute(
            'select content from public.match_document_chunks(%s, %s::extensions.vector)',
            (project_id, EMBEDDING),
        )

        assert [row[0] for row in cur.fetchall()] == ['ready chunk']
        conn.rollback()
