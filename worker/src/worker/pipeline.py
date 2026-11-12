"""
What happens to a source between `processing` and `ready`: parse the file or take the
fetched web page's text, chunk each page, and embed each chunk before saving the results.
"""

from dataclasses import dataclass, replace

from worker.chunking import Chunk, chunk_pages
from worker.db import ClaimedSource
from worker.embeddings import Embedder, EmbeddingUnavailableError
from worker.parsing import Page, ParseError, parse
from worker.web import WebPage


class ProcessingError(Exception):
    """A failure the user should see. The message goes to sources.processing_error."""


@dataclass(frozen=True)
class ProcessedSource:
    # Goes to sources.metadata.
    metadata: dict[str, str | int]
    # Go to document_chunks.
    chunks: list[Chunk]


def process(
    source: ClaimedSource,
    file_bytes: bytes,
    embedder: Embedder | None = None,
) -> ProcessedSource:
    if not file_bytes:
        raise ProcessingError('The file is empty.')

    try:
        document = parse(source.kind, file_bytes)
    except ParseError as error:
        raise ProcessingError(str(error)) from error

    chunks = chunk_and_embed(document.pages, embedder)

    return ProcessedSource(metadata=document.metadata, chunks=chunks)


def process_page(page: WebPage, embedder: Embedder | None = None) -> ProcessedSource:
    """A link's fetched page. A web page has no page numbers, like plain text."""
    metadata: dict[str, str | int] = {'character_count': len(page.text)}

    if page.title:
        metadata['title'] = page.title

    chunks = chunk_and_embed([Page(number=None, text=page.text)], embedder)

    return ProcessedSource(metadata=metadata, chunks=chunks)


def chunk_and_embed(pages: list[Page], embedder: Embedder | None) -> list[Chunk]:
    chunks = chunk_pages(pages)

    if embedder is None:
        return chunks

    try:
        vectors = embedder.embed([chunk.content for chunk in chunks])
    except EmbeddingUnavailableError as error:
        raise ProcessingError(
            'The embedding service is busy or unavailable. Retry processing in a few '
            'minutes.'
        ) from error

    if len(vectors) != len(chunks):
        raise ProcessingError('The embedding service returned an invalid response.')

    return [
        replace(chunk, embedding=vector)
        for chunk, vector in zip(chunks, vectors, strict=True)
    ]
