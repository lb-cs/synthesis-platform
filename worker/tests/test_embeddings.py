from pathlib import Path

import httpx
import pytest

from worker.embeddings import (
    EMBEDDING_BATCH_SIZE,
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
    EMBEDDINGS_URL,
    MAX_ATTEMPTS,
    MAX_DELAY_SECONDS,
    EmbeddingUnavailableError,
    GatewayEmbedder,
    retry_delay,
)

# The app embeds questions here. Chunks and questions must use the same model to match.
APP_AI_MODULE = Path(__file__).parents[2] / 'lib' / 'ai.ts'


class FakeResponse:
    status_code = 200

    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class FakeHTTPClient:
    def __init__(self, dimensions: int = EMBEDDING_DIMENSIONS) -> None:
        self.dimensions = dimensions
        self.calls = []

    def post(self, url, *, headers, json):
        self.calls.append((url, headers, json))
        input = json['input']
        data = [
            {'index': i, 'embedding': [float(i + 1)] * self.dimensions}
            for i in reversed(range(len(input)))
        ]
        return FakeResponse({'data': data})


class ScriptedHTTPClient:
    """Answers each call with the next scripted outcome: a status code or an exception."""

    def __init__(self, *outcomes) -> None:
        self.outcomes = list(outcomes)
        self.calls = 0

    def post(self, url, *, headers, json):
        self.calls += 1
        outcome = self.outcomes.pop(0)
        request = httpx.Request('POST', url)

        if isinstance(outcome, Exception):
            raise outcome

        if isinstance(outcome, tuple):
            status, response_headers = outcome
            return httpx.Response(status, headers=response_headers, request=request)

        if outcome != 200:
            return httpx.Response(outcome, request=request)

        data = [
            {'index': i, 'embedding': [0.5] * EMBEDDING_DIMENSIONS}
            for i in range(len(json['input']))
        ]
        return httpx.Response(200, json={'data': data}, request=request)


def test_requests_small_model_and_restores_response_order():
    client = FakeHTTPClient()
    vectors = GatewayEmbedder('gateway-test', client).embed(['first', 'second'])

    assert client.calls == [
        (
            'https://ai-gateway.vercel.sh/v1/embeddings',
            {'Authorization': 'Bearer gateway-test'},
            {
                'model': 'openai/text-embedding-3-small',
                'input': ['first', 'second'],
                'dimensions': EMBEDDING_DIMENSIONS,
            },
        )
    ]
    assert vectors[0].startswith('[1,1,1,')
    assert vectors[1].startswith('[2,2,2,')
    assert len(vectors[0].strip('[]').split(',')) == EMBEDDING_DIMENSIONS


def test_empty_input_does_not_call_api():
    client = FakeHTTPClient()

    assert GatewayEmbedder('gateway-test', client).embed([]) == []
    assert client.calls == []


def test_splits_large_input_into_bounded_requests():
    client = FakeHTTPClient()
    inputs = [f'chunk {i}' for i in range(EMBEDDING_BATCH_SIZE + 1)]

    vectors = GatewayEmbedder('gateway-test', client).embed(inputs)

    assert [len(call[2]['input']) for call in client.calls] == [EMBEDDING_BATCH_SIZE, 1]
    assert len(vectors) == len(inputs)


def test_rejects_wrong_vector_dimension():
    client = FakeHTTPClient(dimensions=3)

    with pytest.raises(ValueError, match='wrong size'):
        GatewayEmbedder('gateway-test', client).embed(['one chunk'])


def test_uses_the_same_model_and_dimensions_as_the_app():
    app_source = APP_AI_MODULE.read_text()

    assert f"const EMBEDDING_MODEL = '{EMBEDDING_MODEL}';" in app_source
    assert f'export const EMBEDDING_DIMENSIONS = {EMBEDDING_DIMENSIONS};' in app_source


def test_retries_a_rate_limit_after_the_retry_after_delay():
    client = ScriptedHTTPClient((429, {'retry-after': '7'}), 200)
    sleeps = []

    vectors = GatewayEmbedder('gateway-test', client, sleeps.append).embed(['one'])

    assert len(vectors) == 1
    assert client.calls == 2
    assert sleeps == [7.0]


def test_backs_off_exponentially_on_gateway_errors():
    client = ScriptedHTTPClient(503, 502, 500, 200)
    sleeps = []

    GatewayEmbedder('gateway-test', client, sleeps.append).embed(['one'])

    assert sleeps == [1.0, 2.0, 4.0]


def test_retries_a_dropped_connection():
    request = httpx.Request('POST', EMBEDDINGS_URL)
    client = ScriptedHTTPClient(httpx.ConnectTimeout('slow', request=request), 200)
    sleeps = []

    vectors = GatewayEmbedder('gateway-test', client, sleeps.append).embed(['one'])

    assert len(vectors) == 1
    assert sleeps == [1.0]


def test_gives_up_after_the_last_attempt():
    client = ScriptedHTTPClient(*[429] * MAX_ATTEMPTS)
    sleeps = []

    with pytest.raises(EmbeddingUnavailableError, match='HTTP 429'):
        GatewayEmbedder('gateway-test', client, sleeps.append).embed(['one'])

    assert client.calls == MAX_ATTEMPTS
    assert len(sleeps) == MAX_ATTEMPTS - 1


def test_does_not_retry_an_error_a_retry_cannot_fix():
    client = ScriptedHTTPClient(401)
    sleeps = []

    with pytest.raises(httpx.HTTPStatusError):
        GatewayEmbedder('gateway-test', client, sleeps.append).embed(['one'])

    assert client.calls == 1
    assert sleeps == []


def test_retry_delay_is_capped():
    assert retry_delay(20, None) == MAX_DELAY_SECONDS
    assert retry_delay(1, '3600') == MAX_DELAY_SECONDS


def test_retry_delay_ignores_a_retry_after_date():
    assert retry_delay(2, 'Wed, 21 Oct 2026 07:28:00 GMT') == 2.0
