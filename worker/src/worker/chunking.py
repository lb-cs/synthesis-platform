"""
Splits parsed pages into chunks for document_chunks. A chunk never crosses a page
boundary, so its page_number is exact and a citation can open the right page. Plain
text has no pages: its chunks get page_number None.

Size and overlap (see worker/README.md for the reasoning):
- CHUNK_SIZE: at most 1,000 characters, roughly 250 tokens.
- CHUNK_OVERLAP: the next chunk repeats the last 200 characters of the one before, so a
  sentence cut at a boundary still appears whole in one of them.
"""

import re
from collections.abc import Sequence
from dataclasses import dataclass

from worker.parsing import Page

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

# Where a chunk may end, best first. A paragraph break beats a line break, a line break
# beats a sentence end, and a sentence end beats any space.
BREAK_MARKERS = ('\n\n', '\n', '. ', '? ', '! ', ' ')

HORIZONTAL_SPACE = re.compile(r'[ \t\f\v]+')
BLANK_LINES = re.compile(r'\n{3,}')


@dataclass(frozen=True)
class Chunk:
    # Order within the source, from 0, continuing across pages.
    chunk_index: int
    page_number: int | None
    content: str


def chunk_pages(
    pages: Sequence[Page],
    size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[Chunk]:
    # The overlap must be well under the size, or a chunk could end up inside the
    # previous chunk's overlap and the split would never move forward.
    if size <= 0 or overlap < 0 or overlap >= size // 2:
        raise ValueError('overlap must be under half of size')

    chunks: list[Chunk] = []

    for page in pages:
        for content in split_text(tidy(page.text), size, overlap):
            chunks.append(
                Chunk(chunk_index=len(chunks), page_number=page.number, content=content)
            )

    return chunks


def tidy(text: str) -> str:
    # PDF text arrives with ragged runs of spaces and many blank lines.
    text = HORIZONTAL_SPACE.sub(' ', text)
    text = BLANK_LINES.sub('\n\n', text)

    return text.strip()


def split_text(text: str, size: int, overlap: int) -> list[str]:
    pieces: list[str] = []
    start = 0

    while start < len(text):
        end = find_end(text, start, size)
        piece = text[start:end].strip()

        if piece:
            pieces.append(piece)

        if end >= len(text):
            break

        start = find_start(text, start, end, overlap)

    return pieces


def find_end(text: str, start: int, size: int) -> int:
    hard_end = start + size

    if hard_end >= len(text):
        return len(text)

    # Only break in the back half of the window, so a chunk is never tiny.
    earliest = start + size // 2
    window = text[start:hard_end]

    for marker in BREAK_MARKERS:
        position = window.rfind(marker, earliest - start)

        if position != -1:
            return start + position + len(marker)

    return hard_end


def find_start(text: str, start: int, end: int, overlap: int) -> int:
    if overlap == 0:
        return end

    new_start = max(end - overlap, start + 1)

    # Begin the overlap at a word boundary instead of halfway through a word.
    boundary = text.find(' ', new_start, end)

    if boundary == -1:
        return new_start

    return boundary + 1
