import pytest
from supabase import StorageException

from tests.fakes import FakeFiles, FakeQueue, make_source
from worker import pipeline
from worker.loop import DOWNLOAD_FAILED, UNEXPECTED_FAILURE, process_source


def test_a_readable_file_ends_ready():
    source = make_source(1)
    queue = FakeQueue([])

    process_source(source, queue, FakeFiles())

    assert queue.ready == ['source-1']
    assert queue.failed == {}


def test_an_empty_file_fails_with_a_reason_the_user_can_read():
    source = make_source(1)
    queue = FakeQueue([])

    process_source(source, queue, FakeFiles(lambda _: b''))

    assert queue.failed == {'source-1': 'The file is empty.'}
    assert queue.ready == []


def test_a_missing_file_in_storage_fails_the_source():
    def missing(_: str) -> bytes:
        raise StorageException('Object not found')

    source = make_source(1)
    queue = FakeQueue([])

    process_source(source, queue, FakeFiles(missing))

    assert queue.failed == {'source-1': DOWNLOAD_FAILED}


def test_an_unexpected_error_fails_the_source_without_leaking_the_message(
    monkeypatch: pytest.MonkeyPatch,
):
    def crash(*_: object) -> None:
        raise RuntimeError('KeyError: internal detail')

    monkeypatch.setattr(pipeline, 'process', crash)
    source = make_source(1)
    queue = FakeQueue([])

    process_source(source, queue, FakeFiles())

    assert queue.failed == {'source-1': UNEXPECTED_FAILURE}


def test_a_source_deleted_mid_run_is_not_an_error():
    source = make_source(1)
    queue = FakeQueue([])
    queue.is_still_held = False

    process_source(source, queue, FakeFiles())

    assert queue.ready == ['source-1']


def test_chunks_are_saved_before_the_source_is_marked_ready():
    source = make_source(1)
    queue = FakeQueue([])

    process_source(source, queue, FakeFiles(lambda _: b'Some notes.'))

    assert queue.events == ['saved source-1', 'ready source-1']
    metadata, chunks = queue.saved['source-1']
    assert metadata == {'character_count': 11}
    assert [chunk.content for chunk in chunks] == ['Some notes.']


def test_an_unreadable_file_saves_nothing_and_fails_with_a_readable_reason():
    source = make_source(1, kind='pdf')
    queue = FakeQueue([])

    process_source(source, queue, FakeFiles(lambda _: b'not a pdf'))

    assert queue.saved == {}
    assert queue.failed == {
        'source-1': 'This file could not be read as a PDF. It may be damaged.'
    }


def test_a_failure_while_saving_fails_the_source_instead_of_marking_it_ready():
    source = make_source(1)
    queue = FakeQueue([])
    queue.save_error = ConnectionError('database unreachable')

    process_source(source, queue, FakeFiles())

    assert queue.failed == {'source-1': UNEXPECTED_FAILURE}
    assert queue.ready == []
