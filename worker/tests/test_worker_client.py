import threading

import httpx

from worker.db import SourcesQueue, create_worker_client

# Shaped like a real key; nothing checks the signature.
SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2lnbmF0dXJl'


def test_database_requests_go_through_the_workers_own_http_client():
    requests: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=[])

    client = create_worker_client(
        'https://project.supabase.co', SERVICE_ROLE_KEY, httpx.MockTransport(handle)
    )

    assert SourcesQueue(client).claim(4) == []
    assert len(requests) == 1
    assert str(requests[0].url) == (
        'https://project.supabase.co/rest/v1/rpc/claim_pending_sources'
    )
    assert requests[0].headers['apikey'] == SERVICE_ROLE_KEY


def test_the_database_and_storage_share_that_client():
    client = create_worker_client('https://project.supabase.co', SERVICE_ROLE_KEY)

    assert client.postgrest.session is client.storage.session
    assert client.postgrest.session is client.options.httpx_client


def test_threads_never_share_a_connection_to_supabase():
    # HTTP/2 would multiplex every thread onto one connection, which httpx's sync
    # client can't read from concurrently. Over HTTP/1.1 the pool hands each request in
    # flight its own connection.
    client = create_worker_client('https://project.supabase.co', SERVICE_ROLE_KEY)
    pool = client.postgrest.session._transport._pool

    assert pool._http1 is True
    assert pool._http2 is False


def test_concurrent_claims_all_succeed():
    def handle(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[])

    client = create_worker_client(
        'https://project.supabase.co', SERVICE_ROLE_KEY, httpx.MockTransport(handle)
    )
    queue = SourcesQueue(client)
    results: list[list] = []

    def claim() -> None:
        results.append(queue.claim(1))

    threads = [threading.Thread(target=claim) for _ in range(8)]

    for thread in threads:
        thread.start()

    for thread in threads:
        thread.join()

    assert results == [[]] * 8
