from dataclasses import dataclass

import httpx
import pytest

from worker.web import FetchError
from worker.youtube import (
    NO_CAPTIONS,
    NO_TRANSCRIPT,
    SUPADATA_RATE_LIMITED,
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
                Transcript([Snippet('  First point. ', 0), Snippet('Second point.', 65)]),
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
    with pytest.raises(FetchError, match=NO_CAPTIONS):
        fetch_youtube_transcript(
            'https://youtu.be/dQw4w9WgXcQ',
            FakeTranscriptApi(),
        )


def test_reports_when_youtube_blocks_the_worker_request():
    class IpBlocked(Exception):
        pass

    with pytest.raises(FetchError, match="worker's request to YouTube was blocked"):
        fetch_youtube_transcript(
            'https://youtu.be/dQw4w9WgXcQ',
            FakeTranscriptApi(error=IpBlocked('private request detail')),
        )


def test_reports_videos_with_transcripts_disabled():
    class TranscriptsDisabled(Exception):
        pass

    with pytest.raises(FetchError, match=NO_CAPTIONS):
        fetch_youtube_transcript(
            'https://youtu.be/dQw4w9WgXcQ',
            FakeTranscriptApi(error=TranscriptsDisabled('private request detail')),
        )


def test_reports_transcript_service_errors_with_a_safe_message(caplog):
    with pytest.raises(FetchError, match=NO_TRANSCRIPT):
        fetch_youtube_transcript(
            'https://youtu.be/dQw4w9WgXcQ',
            FakeTranscriptApi(error=RuntimeError('private request detail')),
        )

    assert 'YouTube transcript listing failed (RuntimeError)' in caplog.text


def test_uses_supadata_native_captions_and_keeps_timestamps():
    requests = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                'lang': 'en',
                'content': [
                    {'text': 'First point.', 'offset': 0, 'duration': 1000},
                    {'text': 'Second point.', 'offset': 65000, 'duration': 1200},
                ],
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(respond))
    url = 'https://youtu.be/dQw4w9WgXcQ'

    try:
        page = fetch_youtube_transcript(
            url,
            supadata_api_key='supadata-test-key',
            http_client=client,
        )
    finally:
        client.close()

    request = requests[0]
    assert request.url.params['mode'] == 'native'
    assert request.url.params['url'] == url
    assert request.headers['x-api-key'] == 'supadata-test-key'
    assert page.url == url
    assert page.text == '[00:00] First point.\n[01:05] Second point.'


def test_maps_supadata_rate_limit_without_exposing_response_body():
    def respond(_: httpx.Request) -> httpx.Response:
        return httpx.Response(429, text='private provider response')

    client = httpx.Client(transport=httpx.MockTransport(respond))

    try:
        with pytest.raises(FetchError, match=SUPADATA_RATE_LIMITED) as error:
            fetch_youtube_transcript(
                'https://youtu.be/dQw4w9WgXcQ',
                supadata_api_key='supadata-test-key',
                http_client=client,
            )
    finally:
        client.close()

    assert 'private provider response' not in str(error.value)


def test_maps_supadata_missing_captions_to_the_existing_message():
    def respond(_: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={'error': 'transcript-unavailable'})

    client = httpx.Client(transport=httpx.MockTransport(respond))

    try:
        with pytest.raises(FetchError, match=NO_CAPTIONS):
            fetch_youtube_transcript(
                'https://youtu.be/dQw4w9WgXcQ',
                supadata_api_key='supadata-test-key',
                http_client=client,
            )
    finally:
        client.close()


def test_logs_when_fetching_an_available_transcript_fails(caplog):
    api = FakeTranscriptApi(
        [
            TranscriptEntry(
                'en',
                Transcript([]),
                error=RuntimeError('private request detail'),
            )
        ]
    )

    with pytest.raises(FetchError, match=NO_TRANSCRIPT):
        fetch_youtube_transcript('https://youtu.be/dQw4w9WgXcQ', api)

    assert 'YouTube transcript fetch failed (RuntimeError)' in caplog.text


def test_rejects_malformed_youtube_video_id():
    with pytest.raises(FetchError, match='supported video'):
        fetch_youtube_transcript(
            'https://youtube.com/watch?v=invalid',
            FakeTranscriptApi(),
        )
