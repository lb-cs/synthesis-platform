import pytest

from tests.fakes import make_pdf, make_source
from worker.pipeline import ProcessingError, process


def test_a_pdf_becomes_page_numbered_chunks_and_metadata():
    pdf = make_pdf(['First page.', 'Second page.'], metadata={'author': 'Ada'})

    processed = process(make_source(1, kind='pdf'), pdf)

    assert [(c.chunk_index, c.page_number, c.content) for c in processed.chunks] == [
        (0, 1, 'First page.'),
        (1, 2, 'Second page.'),
    ]
    assert processed.metadata == {'page_count': 2, 'author': 'Ada'}


def test_a_text_file_becomes_chunks_with_no_page_number():
    processed = process(make_source(1, kind='text'), b'Just some notes.')

    assert [(c.chunk_index, c.page_number, c.content) for c in processed.chunks] == [
        (0, None, 'Just some notes.')
    ]
    assert processed.metadata == {'character_count': 16}


def test_an_empty_file_is_rejected_before_parsing():
    with pytest.raises(ProcessingError, match=r'The file is empty\.'):
        process(make_source(1, kind='pdf'), b'')


def test_an_unreadable_file_fails_with_the_parser_message():
    with pytest.raises(ProcessingError) as error:
        process(make_source(1, kind='pdf'), b'not a pdf')

    assert str(error.value) == 'This file could not be read as a PDF. It may be damaged.'


def test_a_pdf_with_no_text_fails_with_the_scan_message():
    with pytest.raises(ProcessingError) as error:
        process(make_source(1, kind='pdf'), make_pdf(['', '']))

    assert 'scan' in str(error.value)
