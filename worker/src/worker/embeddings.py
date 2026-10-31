"""Create embeddings for document chunks through Vercel AI Gateway."""

import logging
import time
from collections.abc import Callable, Sequence
from typing import Protocol

import httpx

# AI Gateway's OpenAI-compatible endpoint. It works outside Vercel with an API key.
EMBEDDINGS_URL = 'https://ai-gateway.vercel.sh/v1/embeddings'
# Must match EMBEDDING_MODEL in lib/ai.ts, or questions and chunks won't match.
EMBEDDING_MODEL = 'openai/text-embedding-3-small'
EMBEDDING_DIMENSIONS = 1536
EMBEDDING_BATCH_SIZE = 128

# Rate limits (429), gateway errors (5xx), and dropped connections usually pass quickly,
# so each batch gets a few tries with exponential backoff before the source fails.
MAX_ATTEMPTS = 5
BASE_DELAY_SECONDS = 1.0
MAX_DELAY_SECONDS = 30.0
RETRYABLE_STATUS_CODES = frozenset({429, 500, 502, 503, 504})

log = logging.getLogger(__name__)


class EmbeddingUnavailableError(Exception):
    """The embeddings API kept failing with errors worth retrying."""


def retry_delay(attempt: int, retry_after: str | None) -> float:
    """Seconds to wait after a failed attempt. Honors a Retry-After header in seconds."""
    if retry_after is not None and retry_after.isdigit():
        return min(float(retry_after), MAX_DELAY_SECONDS)

    return min(BASE_DELAY_SECONDS * 2 ** (attempt - 1), MAX_DELAY_SECONDS)


class Embedder(Protocol):
    def embed(self, texts: Sequence[str]) -> list[str]: ...


class GatewayEmbedder:
    """Calls the embeddings API and returns pgvector-compatible vector strings."""

    def __init__(
        self,
        api_key: str,
        client: httpx.Client | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._api_key = api_key
        self._client = client or httpx.Client(timeout=60.0)
        self._sleep = sleep

    def embed(self, texts: Sequence[str]) -> list[str]:
        vectors: list[str] = []

        for start in range(0, len(texts), EMBEDDING_BATCH_SIZE):
            batch = texts[start : start + EMBEDDING_BATCH_SIZE]
            response = self._post_with_retries(batch)
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

    def _post_with_retries(self, batch: Sequence[str]) -> httpx.Response:
        failure = ''

        for attempt in range(1, MAX_ATTEMPTS + 1):
            retry_after = None

            try:
                response = self._client.post(
                    EMBEDDINGS_URL,
                    headers={'Authorization': f'Bearer {self._api_key}'},
                    json={
                        'model': EMBEDDING_MODEL,
                        'input': list(batch),
                        'dimensions': EMBEDDING_DIMENSIONS,
                    },
                )
            except httpx.TransportError as error:
                failure = type(error).__name__
            else:
                # Any other error (a bad key, a bad request) won't fix itself on a retry.
                if response.status_code not in RETRYABLE_STATUS_CODES:
                    response.raise_for_status()
                    return response

                failure = f'HTTP {response.status_code}'
                retry_after = response.headers.get('retry-after')

            if attempt < MAX_ATTEMPTS:
                delay = retry_delay(attempt, retry_after)
                log.warning('embedding batch failed (%s); retry in %.0fs', failure, delay)
                self._sleep(delay)

        raise EmbeddingUnavailableError(
            f'Embedding API failed {MAX_ATTEMPTS} times; last error: {failure}'
        )
