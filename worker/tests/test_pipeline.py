import pytest

from tests.fakes import make_paragraph_pdf, make_pdf, make_source
from worker.embeddings import EMBEDDING_DIMENSIONS, EmbeddingUnavailableError
from worker.pipeline import ProcessingError, process


class FakeEmbedder:
    def embed(self, texts):
        vector = '[' + ','.join(['0.1'] * EMBEDDING_DIMENSIONS) + ']'
        return [vector for _ in texts]


def test_a_pdf_becomes_page_numbered_chunks_and_metadata():
    pdf = make_pdf(['First page.', 'Second page.'], metadata={'author': 'Ada'})

    processed = process(make_source(1, kind='pdf'), pdf)

    assert [(c.chunk_index, c.page_number, c.content) for c in processed.chunks] == [
        (0, 1, 'First page.'),
        (1, 2, 'Second page.'),
    ]
    assert processed.metadata == {'page_count': 2, 'author': 'Ada'}


def test_pdf_chunks_end_at_a_sentence_not_wherever_a_line_wraps():
    paragraph = (
        'Retrieval augmented generation grounds a model in documents. It splits each '
        'document into passages and searches them by meaning. '
    ) * 3
    pdf = make_paragraph_pdf([paragraph, paragraph, paragraph])

    processed = process(make_source(1, kind='pdf'), pdf)

    assert len(processed.chunks) > 1
    assert all(chunk.content.endswith('.') for chunk in processed.chunks)


def test_a_text_file_becomes_chunks_with_no_page_number():
    processed = process(make_source(1, kind='text'), b'Just some notes.')

    assert [(c.chunk_index, c.page_number, c.content) for c in processed.chunks] == [
        (0, None, 'Just some notes.')
    ]
    assert processed.metadata == {'character_count': 16}


def test_each_chunk_is_embedded_when_an_embedder_is_provided():
    processed = process(make_source(1), b'First passage. Second passage.', FakeEmbedder())

    assert processed.chunks
    assert all(chunk.embedding is not None for chunk in processed.chunks)
    assert all(
        len(chunk.embedding.strip('[]').split(',')) == EMBEDDING_DIMENSIONS
        for chunk in processed.chunks
    )


def test_a_mismatched_embedding_count_is_rejected():
    class BadEmbedder:
        def embed(self, texts):
            return []

    with pytest.raises(ProcessingError, match='invalid response'):
        process(make_source(1), b'Notes.', BadEmbedder())


def test_an_unavailable_embedding_service_fails_with_a_retry_hint():
    class UnavailableEmbedder:
        def embed(self, texts):
            raise EmbeddingUnavailableError('Embedding API failed 5 times')

    with pytest.raises(ProcessingError, match='Retry processing in a few minutes'):
        process(make_source(1), b'Notes.', UnavailableEmbedder())


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
