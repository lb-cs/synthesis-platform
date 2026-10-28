"""Create OpenAI embeddings for document chunks."""

from collections.abc import Sequence
from typing import Protocol

import httpx

EMBEDDING_MODEL = 'text-embedding-3-small'
EMBEDDING_DIMENSIONS = 1536
EMBEDDING_BATCH_SIZE = 128


class Embedder(Protocol):
    def embed(self, texts: Sequence[str]) -> list[str]: ...


class OpenAIEmbedder:
    """Calls the embeddings API and returns pgvector-compatible vector strings."""

    def __init__(self, api_key: str, client: httpx.Client | None = None) -> None:
        self._api_key = api_key
        self._client = client or httpx.Client(timeout=60.0)

    def embed(self, texts: Sequence[str]) -> list[str]:
        vectors: list[str] = []

        for start in range(0, len(texts), EMBEDDING_BATCH_SIZE):
            batch = texts[start : start + EMBEDDING_BATCH_SIZE]
            response = self._client.post(
                'https://api.openai.com/v1/embeddings',
                headers={'Authorization': f'Bearer {self._api_key}'},
                json={
                    'model': EMBEDDING_MODEL,
                    'input': list(batch),
                    'dimensions': EMBEDDING_DIMENSIONS,
                },
            )
            response.raise_for_status()
            ordered = sorted(response.json()['data'], key=lambda item: item['index'])

            if len(ordered) != len(batch):
                raise ValueError(
                    'Embedding API returned an unexpected number of vectors.'
                )

            for item in ordered:
                embedding = item['embedding']
                if len(embedding) != EMBEDDING_DIMENSIONS:
                    raise ValueError(
                        'Embedding API returned a vector with the wrong size.'
                    )
                vectors.append(
                    '[' + ','.join(format(value, '.9g') for value in embedding) + ']'
                )

        return vectors
