from typing import Any

from tests.fakes import make_source
from worker.chunking import Chunk
from worker.db import CHUNK_INSERT_BATCH_SIZE, SourcesQueue


class FakeTable:
    """Records the calls made on one table, in order, like supabase-py's builder."""

    def __init__(self, name: str, calls: list[tuple[Any, ...]]) -> None:
        self._name = name
        self._calls = calls

    def delete(self):
        self._calls.append((self._name, 'delete'))
        return self

    def insert(self, rows: list[dict[str, Any]]):
        self._calls.append((self._name, 'insert', rows))
        return self

    def update(self, changes: dict[str, Any]):
        self._calls.append((self._name, 'update', changes))
        return self

    def eq(self, column: str, value: str):
        self._calls.append((self._name, 'eq', column, value))
        return self

    def execute(self):
        return self


class FakeClient:
    def __init__(self) -> None:
        self.calls: list[tuple[Any, ...]] = []

    def table(self, name: str) -> FakeTable:
        return FakeTable(name, self.calls)


def make_chunks(count: int) -> list[Chunk]:
    return [
        Chunk(chunk_index=n, page_number=1, content=f'chunk {n}') for n in range(count)
    ]


def inserted_batches(client: FakeClient) -> list[list[dict[str, Any]]]:
    return [call[2] for call in client.calls if call[:2] == ('document_chunks', 'insert')]


def test_each_chunk_is_stored_with_its_source_project_index_and_page():
    client = FakeClient()
    chunks = [
        Chunk(chunk_index=0, page_number=3, content='on page three'),
        Chunk(chunk_index=1, page_number=None, content='no page'),
    ]

    SourcesQueue(client).save_results(make_source(1), {'page_count': 3}, chunks)

    assert inserted_batches(client) == [
        [
            {
                'source_id': 'source-1',
                'project_id': 'project-1',
                'chunk_index': 0,
                'content': 'on page three',
                'page_number': 3,
            },
            {
                'source_id': 'source-1',
                'project_id': 'project-1',
                'chunk_index': 1,
                'content': 'no page',
                'page_number': None,
            },
        ]
    ]


def test_old_chunks_are_cleared_first_so_a_retry_starts_clean():
    client = FakeClient()

    SourcesQueue(client).save_results(make_source(1), {}, make_chunks(2))

    assert client.calls[:2] == [
        ('document_chunks', 'delete'),
        ('document_chunks', 'eq', 'source_id', 'source-1'),
    ]
    assert client.calls[2][:2] == ('document_chunks', 'insert')


def test_many_chunks_are_inserted_in_batches():
    client = FakeClient()
    total = CHUNK_INSERT_BATCH_SIZE * 2 + 5

    SourcesQueue(client).save_results(make_source(1), {}, make_chunks(total))

    sizes = [len(batch) for batch in inserted_batches(client)]
    assert sizes == [CHUNK_INSERT_BATCH_SIZE, CHUNK_INSERT_BATCH_SIZE, 5]


def test_metadata_is_written_only_to_a_source_still_being_processed():
    client = FakeClient()

    SourcesQueue(client).save_results(make_source(1), {'page_count': 4}, make_chunks(1))

    assert client.calls[-3:] == [
        ('sources', 'update', {'metadata': {'page_count': 4}}),
        ('sources', 'eq', 'id', 'source-1'),
        ('sources', 'eq', 'status', 'processing'),
    ]
