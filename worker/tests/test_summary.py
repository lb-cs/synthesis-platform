from pathlib import Path

import httpx

from tests.fakes import FakeFiles, FakePages, FakeQueue, make_source
from tests.test_process_source import FakeEmbedder
from worker.loop import process_source
from worker.summary import (
    MAX_ATTEMPTS,
    SUMMARY_LENGTH_LIMIT,
    SUMMARY_MODEL,
    SUMMARY_URL,
    GatewaySummarizer,
    sample_texts,
)

APP_AI_MODULE = Path(__file__).parents[2] / 'lib' / 'ai.ts'


class FakeResponse:
    def __init__(self, status_code=200, payload=None, headers=None):
        self.status_code = status_code
        self.payload = payload
        self.headers = headers or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError('bad', request=None, response=None)

    def json(self):
        return self.payload


class ScriptedClient:
    """Returns (or raises) the scripted results in order, and records each call."""

    def __init__(self, results):
        self.results = list(results)
        self.calls = []

    def post(self, url, *, headers, json):
        self.calls.append((url, headers, json))
        result = self.results.pop(0)

        if isinstance(result, Exception):
            raise result

        return result


def completion(content):
    return FakeResponse(payload={'choices': [{'message': {'content': content}}]})


def make_summarizer(results):
    client = ScriptedClient(results)

    return GatewaySummarizer('key', client=client, sleep=lambda _: None), client


class FakeSummarizer:
    def __init__(self, summary):
        self.summary = summary
        self.calls = []

    def summarize(self, title, texts):
        self.calls.append((title, list(texts)))
        return self.summary


def test_a_short_source_is_sent_whole():
    assert sample_texts(['one', 'two', 'three'], limit=100) == 'one\n\ntwo\n\nthree'


def test_a_long_source_is_sampled_from_start_to_end_within_the_limit():
    texts = [f'{index:02d}' + 'x' * 98 for index in range(50)]

    sampled = sample_texts(texts, limit=1000)

    assert len(sampled) <= 1000
    assert sampled.startswith('00')
    assert '\n\n49' in sampled
    # Not just the front of the document.
    assert '\n\n01' not in sampled


def test_the_summary_comes_back_on_one_line_from_the_chat_model():
    summarizer, client = make_summarizer(
        [completion('  A paper on reefs.\nIt finds X. ')]
    )

    summary = summarizer.summarize('Coral reefs', ['Reefs are bleaching.'])

    assert summary == 'A paper on reefs. It finds X.'
    url, headers, body = client.calls[0]
    assert url == SUMMARY_URL
    assert headers == {'Authorization': 'Bearer key'}
    assert body['model'] == SUMMARY_MODEL
    assert 'Title: Coral reefs' in body['messages'][1]['content']
    assert 'Reefs are bleaching.' in body['messages'][1]['content']


def test_an_overlong_summary_is_cut():
    summarizer, _ = make_summarizer([completion('word ' * 1000)])

    summary = summarizer.summarize(None, ['text'])

    assert summary is not None
    assert len(summary) <= SUMMARY_LENGTH_LIMIT


def test_a_busy_gateway_is_retried():
    summarizer, client = make_summarizer(
        [FakeResponse(429), httpx.ConnectError('down'), completion('Fine.')]
    )

    assert summarizer.summarize(None, ['text']) == 'Fine.'
    assert len(client.calls) == 3


def test_a_gateway_that_stays_busy_gives_no_summary():
    summarizer, client = make_summarizer([FakeResponse(503)] * MAX_ATTEMPTS)

    assert summarizer.summarize(None, ['text']) is None
    assert len(client.calls) == MAX_ATTEMPTS


def test_a_rejected_request_gives_no_summary_and_is_not_retried():
    summarizer, client = make_summarizer([FakeResponse(401)])

    assert summarizer.summarize(None, ['text']) is None
    assert len(client.calls) == 1


def test_a_malformed_response_gives_no_summary():
    summarizer, _ = make_summarizer([FakeResponse(payload={'choices': []})])

    assert summarizer.summarize(None, ['text']) is None


def test_a_source_with_no_text_is_not_sent():
    summarizer, client = make_summarizer([])

    assert summarizer.summarize(None, []) is None
    assert client.calls == []


def test_a_processed_source_saves_its_summary_in_metadata():
    source = make_source(1, kind='link')
    queue = FakeQueue([])
    summarizer = FakeSummarizer('An article about greetings.')

    process_source(source, queue, FakeFiles(), FakePages(), FakeEmbedder(), summarizer)

    metadata, _ = queue.saved['source-1']
    assert metadata['summary'] == 'An article about greetings.'
    assert summarizer.calls == [('An article', ['Hello from the web.'])]
    assert queue.ready == ['source-1']


def test_a_source_still_ends_ready_without_a_summary():
    source = make_source(1)
    queue = FakeQueue([])

    process_source(
        source, queue, FakeFiles(), FakePages(), FakeEmbedder(), FakeSummarizer(None)
    )

    metadata, _ = queue.saved['source-1']
    assert 'summary' not in metadata
    assert queue.ready == ['source-1']


def test_the_summary_model_is_the_apps_chat_model():
    assert f"const CHAT_MODEL = '{SUMMARY_MODEL}';" in APP_AI_MODULE.read_text()
