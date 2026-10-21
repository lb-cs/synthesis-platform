"""
Turns an uploaded file into text, one entry per page. PDFs are read with PyMuPDF (the
pick from the CECS491-56 spike); plain text has no pages, so it comes back as one entry
with no page number. Anything the worker can't read raises ParseError, whose message is
safe to show the user.
"""

from dataclasses import dataclass

import pymupdf

# Written to sources.processing_error, which the sources page shows the user.
NOT_A_PDF = 'This file could not be read as a PDF. It may be damaged.'
PASSWORD_PROTECTED = (
    'This PDF is password-protected. Remove the password and upload it again.'
)
NO_PDF_TEXT = (
    'No text could be read from this PDF. It may be a scan made of images, which is '
    'not supported yet.'
)
NOT_UTF8 = 'This text file is not UTF-8. Save it as UTF-8 and upload it again.'
NOT_TEXT = 'This file does not look like a text file.'
NO_TEXT = 'The file has no text in it.'

# The PDF fields worth keeping, as PyMuPDF names them, and the key each is stored under
# in sources.metadata.
PDF_METADATA_FIELDS = {
    'title': 'title',
    'author': 'author',
    'subject': 'subject',
    'keywords': 'keywords',
    'creator': 'creator',
    'producer': 'producer',
}


class ParseError(Exception):
    """The file can't be turned into text. The message is shown to the user."""


@dataclass(frozen=True)
class Page:
    # One-based, so it matches the page number a reader sees. None for plain text.
    number: int | None
    text: str


@dataclass(frozen=True)
class ParsedDocument:
    pages: list[Page]
    # Goes to sources.metadata (jsonb), so only strings and numbers.
    metadata: dict[str, str | int]


def parse(kind: str, file_bytes: bytes) -> ParsedDocument:
    if kind == 'pdf':
        return parse_pdf(file_bytes)

    if kind == 'text':
        return parse_text(file_bytes)

    raise ParseError(f'Files of type "{kind}" are not supported.')


def parse_pdf(file_bytes: bytes) -> ParsedDocument:
    try:
        document = pymupdf.open(stream=file_bytes, filetype='pdf')
    except (pymupdf.FileDataError, pymupdf.EmptyFileError) as error:
        raise ParseError(NOT_A_PDF) from error

    with document:
        if document.needs_pass:
            raise ParseError(PASSWORD_PROTECTED)

        try:
            pages = [
                Page(number=number, text=clean(page.get_text('text')))
                for number, page in enumerate(document, start=1)
            ]
        except RuntimeError as error:
            # PyMuPDF raises this for a PDF that opens but breaks while being read.
            raise ParseError(NOT_A_PDF) from error

        metadata = pdf_metadata(document, page_count=len(pages))

    if not any(page.text for page in pages):
        raise ParseError(NO_PDF_TEXT)

    return ParsedDocument(pages=pages, metadata=metadata)


def pdf_metadata(document: pymupdf.Document, page_count: int) -> dict[str, str | int]:
    found = document.metadata or {}
    metadata: dict[str, str | int] = {'page_count': page_count}

    for field, key in PDF_METADATA_FIELDS.items():
        value = clean(found.get(field) or '')

        if value:
            metadata[key] = value

    return metadata


def parse_text(file_bytes: bytes) -> ParsedDocument:
    try:
        # utf-8-sig drops the byte-order mark Windows editors add.
        text = file_bytes.decode('utf-8-sig')
    except UnicodeDecodeError as error:
        raise ParseError(NOT_UTF8) from error

    # A NUL byte means a binary file with a text extension, not a text file.
    if '\x00' in text:
        raise ParseError(NOT_TEXT)

    text = clean(text)

    if not text:
        raise ParseError(NO_TEXT)

    return ParsedDocument(
        pages=[Page(number=None, text=text)],
        metadata={'character_count': len(text)},
    )


def clean(text: str) -> str:
    # Postgres can't store a NUL character in text or jsonb, and PDFs sometimes contain
    # one. Windows line endings become plain newlines so chunks look the same everywhere.
    return text.replace('\x00', '').replace('\r\n', '\n').replace('\r', '\n').strip()
