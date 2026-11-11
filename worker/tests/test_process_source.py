import pytest
from supabase import StorageException

from tests.fakes import FakeFiles, FakePages, FakeQueue, make_source
from worker import pipeline
from worker.embeddings import EMBEDDING_DIMENSIONS
from worker.loop import (
    DOWNLOAD_FAILED,
    UNEXPECTED_FAILURE,
    process_source,
)
from worker.web import NEEDS_LOGIN, FetchError, WebPage


class FakeEmbedder:
    def embed(self, texts):
        vector = '[' + ','.join(['0.1'] * EMBEDDING_DIMENSIONS) + ']'
        return [vector for _ in texts]


def test_a_readable_file_ends_ready():
    source = make_source(1)
    queue = FakeQueue([])

    process_source(source, queue, FakeFiles(), FakePages(), FakeEmbedder())

    assert queue.ready == ['source-1']
    assert queue.failed == {}
    _, chunks = queue.saved['source-1']
    assert len(chunks) == 1
    assert chunks[0].embedding is not None


def test_an_empty_file_fails_with_a_reason_the_user_can_read():
    source = make_source(1)
    queue = FakeQueue([])

    process_source(source, queue, FakeFiles(lambda _: b''), FakePages(), FakeEmbedder())

    assert queue.failed == {'source-1': 'The file is empty.'}
    assert queue.ready == []


def test_a_link_is_fetched_and_ends_ready_with_the_page_title():
    source = make_source(1, kind='link')
    queue = FakeQueue([])
    fetched: list[str] = []

    def fetch(url: str) -> WebPage:
        fetched.append(url)
        return WebPage(url=url, title='Coral reefs', text='Reefs are bleaching.')

    def never_called(_: str) -> bytes:
        raise AssertionError('a link has no file to download')

    process_source(
        source, queue, FakeFiles(never_called), FakePages(fetch), FakeEmbedder()
    )

    assert fetched == ['https://example.com/article-1']
    assert queue.ready == ['source-1']
    metadata, chunks = queue.saved['source-1']
    assert metadata == {'title': 'Coral reefs', 'character_count': 20}
    assert [chunk.content for chunk in chunks] == ['Reefs are bleaching.']
    assert chunks[0].page_number is None
    assert chunks[0].embedding is not None


def test_a_page_that_cannot_be_read_fails_the_link_with_its_reason():
    source = make_source(1, kind='link')
    queue = FakeQueue([])

    def blocked(_: str) -> WebPage:
        raise FetchError(NEEDS_LOGIN)

    process_source(source, queue, FakeFiles(), FakePages(blocked), FakeEmbedder())

    assert queue.failed == {'source-1': NEEDS_LOGIN}
    assert queue.saved == {}


def test_a_missing_file_in_storage_fails_the_source():
    def missing(_: str) -> bytes:
        raise StorageException('Object not found')

    source = make_source(1)
    queue = FakeQueue([])

    process_source(source, queue, FakeFiles(missing), FakePages(), FakeEmbedder())

    assert queue.failed == {'source-1': DOWNLOAD_FAILED}


def test_an_unexpected_error_fails_the_source_without_leaking_the_message(
    monkeypatch: pytest.MonkeyPatch,
):
    def crash(*_: object) -> None:
        raise RuntimeError('KeyError: internal detail')

    monkeypatch.setattr(pipeline, 'process', crash)
    source = make_source(1)
    queue = FakeQueue([])

    process_source(source, queue, FakeFiles(), FakePages(), FakeEmbedder())

    assert queue.failed == {'source-1': UNEXPECTED_FAILURE}


def test_a_source_deleted_mid_run_is_not_an_error():
    source = make_source(1)
    queue = FakeQueue([])
    queue.is_still_held = False

    process_source(source, queue, FakeFiles(), FakePages(), FakeEmbedder())

    assert queue.ready == ['source-1']


def test_chunks_are_saved_before_the_source_is_marked_ready():
    source = make_source(1)
    queue = FakeQueue([])

    process_source(
        source, queue, FakeFiles(lambda _: b'Some notes.'), FakePages(), FakeEmbedder()
    )

    assert queue.events == ['saved source-1', 'ready source-1']
    metadata, chunks = queue.saved['source-1']
    assert metadata == {'character_count': 11}
    assert [chunk.content for chunk in chunks] == ['Some notes.']


def test_an_unreadable_file_saves_nothing_and_fails_with_a_readable_reason():
    source = make_source(1, kind='pdf')
    queue = FakeQueue([])

    process_source(
        source, queue, FakeFiles(lambda _: b'not a pdf'), FakePages(), FakeEmbedder()
    )

    assert queue.saved == {}
    assert queue.failed == {
        'source-1': 'This file could not be read as a PDF. It may be damaged.'
    }


def test_a_failure_while_saving_fails_the_source_instead_of_marking_it_ready():
    source = make_source(1)
    queue = FakeQueue([])
    queue.save_error = ConnectionError('database unreachable')

    process_source(source, queue, FakeFiles(), FakePages(), FakeEmbedder())

    assert queue.failed == {'source-1': UNEXPECTED_FAILURE}
    assert queue.ready == []


def test_embedding_failure_marks_source_failed_without_leaking_provider_details():
    class BrokenEmbedder:
        def embed(self, texts):
            raise RuntimeError('provider secret or request detail')

    source = make_source(1)
    queue = FakeQueue([])

    process_source(source, queue, FakeFiles(), FakePages(), BrokenEmbedder())

    assert queue.failed == {'source-1': UNEXPECTED_FAILURE}
    assert queue.saved == {}
