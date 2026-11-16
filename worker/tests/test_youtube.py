from dataclasses import dataclass

import pytest

from worker.web import FetchError
from worker.youtube import (
    NO_TRANSCRIPT,
    fetch_youtube_transcript,
    format_timestamp,
    get_youtube_video_id,
    is_youtube_video_url,
)


@dataclass
class Snippet:
    text: str
    start: float


@dataclass
class Transcript:
    snippets: list[Snippet]


@dataclass
class TranscriptEntry:
    language_code: str
    transcript: Transcript
    error: Exception | None = None

    def fetch(self):
        if self.error is not None:
            raise self.error

        return self.transcript


class FakeTranscriptApi:
    def __init__(self, entries=None, error=None):
        self.entries = entries or []
        self.error = error
        self.requested: list[str] = []

    def list(self, video_id):
        self.requested.append(video_id)

        if self.error is not None:
            raise self.error

        return self.entries


@pytest.mark.parametrize(
    ('url', 'video_id'),
    [
        ('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'),
        ('https://youtu.be/dQw4w9WgXcQ?t=20', 'dQw4w9WgXcQ'),
        ('https://youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'),
        ('https://m.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'),
        ('https://youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'),
        ('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'),
    ],
)
def test_extracts_video_id_from_supported_youtube_links(url, video_id):
    assert get_youtube_video_id(url) == video_id
    assert is_youtube_video_url(url)


@pytest.mark.parametrize(
    'url',
    [
        'https://example.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com/channel/dQw4w9WgXcQ',
        'https://youtube.com/watch?v=invalid',
        'ftp://youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    ],
)
def test_rejects_non_video_urls(url):
    assert get_youtube_video_id(url) is None


@pytest.mark.parametrize(
    ('seconds', 'expected'),
    [(0, '00:00'), (125, '02:05'), (3670, '01:01:10')],
)
def test_formats_transcript_timestamps(seconds, expected):
    assert format_timestamp(seconds) == expected


def test_fetches_english_captions_as_timestamped_web_page_text():
    api = FakeTranscriptApi(
        [
            TranscriptEntry('es', Transcript([Snippet('Primer punto.', 0)])),
            TranscriptEntry(
                'en',
                Transcript(
                    [Snippet('  First point. ', 0), Snippet('Second point.', 65)]
                ),
            ),
        ]
    )
    url = 'https://youtu.be/dQw4w9WgXcQ'

    page = fetch_youtube_transcript(url, api)

    assert api.requested == ['dQw4w9WgXcQ']
    assert page.url == url
    assert page.text == '[00:00] First point.\n[01:05] Second point.'


def test_falls_back_to_an_available_non_english_caption_track():
    api = FakeTranscriptApi(
        [TranscriptEntry('es', Transcript([Snippet('Primer punto.', 12)]))]
    )

    page = fetch_youtube_transcript('https://youtu.be/dQw4w9WgXcQ', api)

    assert page.text == '[00:12] Primer punto.'


def test_reports_videos_without_readable_captions():
    with pytest.raises(FetchError, match='captions'):
        fetch_youtube_transcript(
            'https://youtu.be/dQw4w9WgXcQ',
            FakeTranscriptApi(),
        )


def test_reports_transcript_service_errors_with_a_safe_message():
    with pytest.raises(FetchError, match=NO_TRANSCRIPT):
        fetch_youtube_transcript(
            'https://youtu.be/dQw4w9WgXcQ',
            FakeTranscriptApi(error=RuntimeError('private request detail')),
        )


def test_rejects_malformed_youtube_video_id():
    with pytest.raises(FetchError, match='supported video'):
        fetch_youtube_transcript(
            'https://youtube.com/watch?v=invalid',
            FakeTranscriptApi(),
        )
