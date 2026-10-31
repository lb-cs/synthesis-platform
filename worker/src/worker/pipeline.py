"""
What happens to a source between `processing` and `ready`: parse it, chunk each page,
and embed each chunk before saving the results.
"""

from dataclasses import dataclass, replace

from worker.chunking import Chunk, chunk_pages
from worker.db import ClaimedSource
from worker.embeddings import Embedder, EmbeddingUnavailableError
from worker.parsing import ParseError, parse


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

    chunks = chunk_pages(document.pages)

    if embedder is not None:
        try:
            vectors = embedder.embed([chunk.content for chunk in chunks])
        except EmbeddingUnavailableError as error:
            raise ProcessingError(
                'The embedding service is busy or unavailable. Retry processing in a few '
                'minutes.'
            ) from error

        if len(vectors) != len(chunks):
            raise ProcessingError('The embedding service returned an invalid response.')

        chunks = [
            replace(chunk, embedding=vector)
            for chunk, vector in zip(chunks, vectors, strict=True)
        ]

    return ProcessedSource(metadata=document.metadata, chunks=chunks)
