import pytest

from worker.embeddings import (
    EMBEDDING_BATCH_SIZE,
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
    OpenAIEmbedder,
)


class FakeResponse:
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


def test_requests_small_model_and_restores_response_order():
    client = FakeHTTPClient()
    vectors = OpenAIEmbedder('sk-test', client).embed(['first', 'second'])

    assert client.calls == [
        (
            'https://api.openai.com/v1/embeddings',
            {'Authorization': 'Bearer sk-test'},
            {
                'model': EMBEDDING_MODEL,
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

    assert OpenAIEmbedder('sk-test', client).embed([]) == []
    assert client.calls == []


def test_splits_large_input_into_bounded_requests():
    client = FakeHTTPClient()
    inputs = [f'chunk {i}' for i in range(EMBEDDING_BATCH_SIZE + 1)]

    vectors = OpenAIEmbedder('sk-test', client).embed(inputs)

    assert [len(call[2]['input']) for call in client.calls] == [EMBEDDING_BATCH_SIZE, 1]
    assert len(vectors) == len(inputs)


def test_rejects_wrong_vector_dimension():
    client = FakeHTTPClient(dimensions=3)

    with pytest.raises(ValueError, match='wrong size'):
        OpenAIEmbedder('sk-test', client).embed(['one chunk'])
