"""
What happens to a source between `processing` and `ready`. Parsing, chunking, and
embedding are separate stories; they plug in to process() and nothing else changes.
"""

from worker.db import ClaimedSource


class ProcessingError(Exception):
    """A failure the user should see. The message goes to sources.processing_error."""


def process(source: ClaimedSource, file_bytes: bytes) -> None:
    if not file_bytes:
        raise ProcessingError('The file is empty.')
