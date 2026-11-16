"""Fetch an English YouTube transcript as timestamped source text."""

import logging
import math
import re
from collections.abc import Iterable, Sequence
from typing import Protocol
from urllib.parse import parse_qs, urlparse

import httpx

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
NO_CAPTIONS = 'No captions are available for this YouTube video.'
SUPADATA_ENDPOINT = 'https://api.supadata.ai/v1/transcript'
SUPADATA_TIMEOUT_SECONDS = 20.0
SUPADATA_RATE_LIMITED = (
    'The transcript service reached its request limit. Retry later or upload '
    'a transcript.'
)
SUPADATA_UNAVAILABLE = (
    'The transcript service could not retrieve captions. Retry later or upload '
    'a transcript.'
)
SUPADATA_BAD_KEY = 'The transcript service rejected its API key. Contact the team.'
YOUTUBE_REQUEST_BLOCKED = (
    "The worker's request to YouTube was blocked. Retry later or contact the team."
)
BLOCKED_ERROR_NAMES = frozenset({'RequestBlocked', 'IpBlocked'})
CAPTIONS_ERROR_NAMES = frozenset({'NoTranscriptFound', 'TranscriptsDisabled'})


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


def transcript_error_message(error: Exception) -> str:
    """Map known transcript failures to safe, useful messages for the sources page."""
    error_name = type(error).__name__

    if error_name in BLOCKED_ERROR_NAMES:
        return YOUTUBE_REQUEST_BLOCKED

    if error_name in CAPTIONS_ERROR_NAMES:
        return NO_CAPTIONS

    return NO_TRANSCRIPT


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
    supadata_api_key: str | None = None,
    http_client: httpx.Client | None = None,
) -> WebPage:
    """Fetch captions and return them through the existing link chunk/embed pipeline."""
    video_id = get_youtube_video_id(url)

    if video_id is None:
        raise FetchError(NO_VIDEO_ID)

    if supadata_api_key:
        return fetch_supadata_transcript(url, supadata_api_key, http_client)

    client = transcript_api

    if client is None:
        from youtube_transcript_api import YouTubeTranscriptApi

        client = YouTubeTranscriptApi()

    try:
        available = list(client.list(video_id))
    except Exception as error:
        log.warning('YouTube transcript listing failed (%s)', type(error).__name__)
        raise FetchError(transcript_error_message(error)) from error

    english = next(
        (entry for entry in available if entry.language_code.lower().startswith('en')),
        None,
    )
    selected = english or (available[0] if available else None)

    if selected is None:
        log.warning('YouTube video has no available transcript tracks')
        raise FetchError(NO_CAPTIONS)

    try:
        transcript = selected.fetch()
    except Exception as error:
        log.warning('YouTube transcript fetch failed (%s)', type(error).__name__)
        raise FetchError(transcript_error_message(error)) from error

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


def fetch_supadata_transcript(
    url: str,
    api_key: str,
    http_client: httpx.Client | None = None,
) -> WebPage:
    """Use existing captions only, avoiding paid audio transcription."""
    try:
        if http_client is None:
            response = httpx.get(
                SUPADATA_ENDPOINT,
                params={'url': url, 'mode': 'native'},
                headers={'x-api-key': api_key},
                timeout=SUPADATA_TIMEOUT_SECONDS,
            )
        else:
            response = http_client.get(
                SUPADATA_ENDPOINT,
                params={'url': url, 'mode': 'native'},
                headers={'x-api-key': api_key},
                timeout=SUPADATA_TIMEOUT_SECONDS,
            )

        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPStatusError as error:
        status_code = error.response.status_code
        log.warning('Supadata transcript request failed (HTTP %d)', status_code)
        try:
            provider_error = error.response.json().get('error')
        except (AttributeError, ValueError):
            provider_error = None

        if status_code == 404 or provider_error == 'transcript-unavailable':
            raise FetchError(NO_CAPTIONS) from error

        if status_code == 429:
            raise FetchError(SUPADATA_RATE_LIMITED) from error

        if status_code in {401, 403}:
            raise FetchError(SUPADATA_BAD_KEY) from error

        raise FetchError(SUPADATA_UNAVAILABLE) from error
    except (httpx.HTTPError, ValueError) as error:
        log.warning('Supadata transcript request failed (%s)', type(error).__name__)
        raise FetchError(SUPADATA_UNAVAILABLE) from error

    segments = payload.get('content') if isinstance(payload, dict) else None

    if not isinstance(segments, list):
        log.warning('Supadata transcript response did not contain caption segments')
        raise FetchError(SUPADATA_UNAVAILABLE)

    lines = []

    for segment in segments:
        if not isinstance(segment, dict):
            continue

        text = segment.get('text')
        offset = segment.get('offset')

        if not isinstance(text, str) or not isinstance(offset, (int, float)):
            continue

        if isinstance(offset, bool) or not math.isfinite(offset):
            continue

        tidy_text = clean(text)

        if tidy_text:
            lines.append(f'[{format_timestamp(offset / 1000)}] {tidy_text}')

    text = clean('\n'.join(lines))

    if not text:
        raise FetchError(NO_CAPTIONS)

    return WebPage(url=url, title=None, text=text)
