"""
What happens to a source between `processing` and `ready`: parse the file into pages,
then chunk the pages. Embedding is a separate story; it plugs in to process() and
nothing else changes.
"""

from dataclasses import dataclass

from worker.chunking import Chunk, chunk_pages
from worker.db import ClaimedSource
from worker.parsing import ParseError, parse


class ProcessingError(Exception):
    """A failure the user should see. The message goes to sources.processing_error."""


@dataclass(frozen=True)
class ProcessedSource:
    # Goes to sources.metadata.
    metadata: dict[str, str | int]
    # Go to document_chunks.
    chunks: list[Chunk]


def process(source: ClaimedSource, file_bytes: bytes) -> ProcessedSource:
    if not file_bytes:
        raise ProcessingError('The file is empty.')

    try:
        document = parse(source.kind, file_bytes)
    except ParseError as error:
        raise ProcessingError(str(error)) from error

    return ProcessedSource(
        metadata=document.metadata,
        chunks=chunk_pages(document.pages),
    )
