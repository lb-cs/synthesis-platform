"""Fetch an English YouTube transcript as timestamped source text."""

import logging
import re
from collections.abc import Iterable, Sequence
from typing import Protocol
from urllib.parse import parse_qs, urlparse

from worker.parsing import clean
from worker.web import FetchError, WebPage

log = logging.getLogger(__name__)

YOUTUBE_HOSTS = frozenset(
    {
        'youtube.com',
        'www.youtube.com',
        'm.youtube.com',
        'music.youtube.com',
        'youtu.be',
        'youtube-nocookie.com',
        'www.youtube-nocookie.com',
    }
)
VIDEO_ID_PATTERN = re.compile(r'^[A-Za-z0-9_-]{11}$')
NO_VIDEO_ID = 'This YouTube link does not point to a supported video.'
NO_TRANSCRIPT = 'YouTube captions could not be retrieved. Enable captions or retry later.'


class TranscriptSnippet(Protocol):
    text: str
    start: float


class FetchedTranscript(Protocol):
    snippets: Sequence[TranscriptSnippet]


class TranscriptEntry(Protocol):
    language_code: str

    def fetch(self) -> FetchedTranscript: ...


class TranscriptClient(Protocol):
    def list(self, video_id: str) -> Iterable[TranscriptEntry]: ...


def get_youtube_video_id(url: str) -> str | None:
    """Return the video ID from common YouTube watch, short, embed, or live links."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return None

    if parsed.scheme not in {'http', 'https'} or parsed.hostname not in YOUTUBE_HOSTS:
        return None

    parts = [part for part in parsed.path.split('/') if part]

    if parsed.hostname == 'youtu.be':
        candidate = parts[0] if parts else None
    elif parsed.path == '/watch':
        candidate = parse_qs(parsed.query).get('v', [None])[0]
    elif len(parts) >= 2 and parts[0] in {'shorts', 'embed', 'live'}:
        candidate = parts[1]
    else:
        candidate = None

    if candidate is None or not VIDEO_ID_PATTERN.fullmatch(candidate):
        return None

    return candidate


def is_youtube_video_url(url: str) -> bool:
    """Recognize video URL shapes so malformed IDs get a clear failure, not HTML text."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return False

    if parsed.scheme not in {'http', 'https'} or parsed.hostname not in YOUTUBE_HOSTS:
        return False

    parts = [part for part in parsed.path.split('/') if part]

    return (
        parsed.hostname == 'youtu.be'
        or parsed.path == '/watch'
        or (len(parts) >= 1 and parts[0] in {'shorts', 'embed', 'live'})
    )


def format_timestamp(seconds: float) -> str:
    total_seconds = max(0, int(seconds))
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    if hours:
        return f'{hours:02}:{minutes:02}:{seconds:02}'

    return f'{minutes:02}:{seconds:02}'


def fetch_youtube_transcript(
    url: str,
    transcript_api: TranscriptClient | None = None,
) -> WebPage:
    """Fetch captions and return them through the existing link chunk/embed pipeline."""
    video_id = get_youtube_video_id(url)

    if video_id is None:
        raise FetchError(NO_VIDEO_ID)

    client = transcript_api

    if client is None:
        from youtube_transcript_api import YouTubeTranscriptApi

        client = YouTubeTranscriptApi()

    try:
        available = list(client.list(video_id))
    except Exception as error:
        log.warning('YouTube transcript listing failed (%s)', type(error).__name__)
        raise FetchError(NO_TRANSCRIPT) from error

    english = next(
        (entry for entry in available if entry.language_code.lower().startswith('en')),
        None,
    )
    selected = english or (available[0] if available else None)

    if selected is None:
        log.warning('YouTube video has no available transcript tracks')
        raise FetchError(NO_TRANSCRIPT)

    try:
        transcript = selected.fetch()
    except Exception as error:
        log.warning('YouTube transcript fetch failed (%s)', type(error).__name__)
        raise FetchError(NO_TRANSCRIPT) from error

    lines = [
        f'[{format_timestamp(snippet.start)}] {clean(snippet.text)}'
        for snippet in transcript.snippets
        if clean(snippet.text)
    ]
    text = clean('\n'.join(lines))

    if not text:
        log.warning('YouTube transcript fetch returned no readable caption text')
        raise FetchError(NO_TRANSCRIPT)

    return WebPage(url=url, title=None, text=text)
