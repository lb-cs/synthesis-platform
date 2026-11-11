"""
PageFetcher against a fake DNS and httpx.MockTransport: no request leaves the machine.
"""

import socket
from collections.abc import Callable

import httpx
import pytest

from worker.web import (
    FETCH_DEADLINE_SECONDS,
    MAX_PAGE_BYTES,
    NEEDS_LOGIN,
    NO_TEXT,
    NOT_TEXT,
    NOT_WEB_ADDRESS,
    PRIVATE_ADDRESS,
    RATE_LIMITED,
    REMOVED,
    SITE_ERROR,
    SITE_NOT_FOUND,
    TIMED_OUT,
    TOO_LARGE,
    TOO_MANY_REDIRECTS,
    UNREACHABLE,
    FetchError,
    PageFetcher,
    is_public_address,
)

PUBLIC_ADDRESS = '93.184.216.34'

ARTICLE = (
    '<html><head><title>Coral reefs | Ocean Weekly</title></head><body>'
    '<nav>Home · About · Subscribe</nav>'
    '<article><h1>Coral reefs are bleaching</h1>'
    + ''.join(
        f'<p>Paragraph {n} on warming oceans and the stress they put on coral, long '
        'enough to read as real content.</p>'
        for n in range(4)
    )
    + '</article><footer>Copyright Ocean Weekly</footer></body></html>'
)

Handler = Callable[[httpx.Request], httpx.Response]


def public_dns(addresses: dict[str, list[str]] | None = None):
    def resolve(host: str, port: int) -> list[str]:
        if addresses is not None and host in addresses:
            return addresses[host]

        return [PUBLIC_ADDRESS]

    return resolve


def make_fetcher(handler: Handler, resolve=None, clock=None) -> PageFetcher:
    client = httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=False)
    kwargs = {'resolve': resolve or public_dns()}

    if clock is not None:
        kwargs['clock'] = clock

    return PageFetcher(client, **kwargs)


def html(body: str, status: int = 200, **headers: str) -> httpx.Response:
    return httpx.Response(
        status, content=body, headers={'content-type': 'text/html', **headers}
    )


def fetch_error(fetcher: PageFetcher, url: str = 'https://example.com/a') -> str:
    with pytest.raises(FetchError) as caught:
        fetcher.fetch(url)

    return str(caught.value)


def test_an_article_comes_back_as_its_readable_text_and_title():
    page = make_fetcher(lambda _: html(ARTICLE)).fetch('https://example.com/reefs')

    assert page.url == 'https://example.com/reefs'
    assert page.title == 'Coral reefs are bleaching'
    assert 'Paragraph 3 on warming oceans' in page.text
    # Navigation and footers are boilerplate, not content.
    assert 'Subscribe' not in page.text
    assert 'Copyright' not in page.text


def test_the_request_goes_to_the_checked_address_with_the_real_host_name():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return html(ARTICLE)

    make_fetcher(handler).fetch('https://Example.com:8443/reefs?id=1')

    request = seen[0]
    assert request.url.host == PUBLIC_ADDRESS
    assert request.url.port == 8443
    assert request.url.raw_path == b'/reefs?id=1'
    assert request.headers['host'] == 'example.com:8443'
    # TLS verifies the certificate for the name, not the address.
    assert request.extensions['sni_hostname'] == 'example.com'


def test_plain_text_is_read_as_is_with_no_title():
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, content='Line one.\r\nLine two.', headers={'content-type': 'text/plain'}
        )

    page = make_fetcher(handler).fetch('https://example.com/notes.txt')

    assert page.title is None
    assert page.text == 'Line one.\nLine two.'


def test_redirects_are_followed_and_the_final_url_is_kept():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == '/old':
            return httpx.Response(301, headers={'location': '/new'})

        return html(ARTICLE)

    page = make_fetcher(handler).fetch('https://example.com/old')

    assert page.url == 'https://example.com/new'


def test_a_redirect_loop_stops_with_a_reason():
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={'location': '/again'})

    assert fetch_error(make_fetcher(handler)) == TOO_MANY_REDIRECTS


@pytest.mark.parametrize(
    'address',
    [
        '127.0.0.1',
        '10.0.0.5',
        '172.16.0.1',
        '192.168.1.1',
        '169.254.169.254',  # cloud metadata
        '100.64.0.1',
        '0.0.0.0',
        '::1',
        'fd00::1',
        '::ffff:127.0.0.1',
    ],
)
def test_a_host_on_a_private_or_local_address_is_refused(address: str):
    def handler(_: httpx.Request) -> httpx.Response:
        raise AssertionError('no request may reach a private address')

    fetcher = make_fetcher(handler, resolve=public_dns({'example.com': [address]}))

    assert fetch_error(fetcher) == PRIVATE_ADDRESS


def test_a_host_with_any_private_address_is_refused():
    def handler(_: httpx.Request) -> httpx.Response:
        raise AssertionError('no request may reach a private address')

    dns = public_dns({'example.com': [PUBLIC_ADDRESS, '10.0.0.5']})

    assert fetch_error(make_fetcher(handler, resolve=dns)) == PRIVATE_ADDRESS


def test_a_redirect_to_a_private_address_is_refused():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.headers['host'] == 'example.com':
            return httpx.Response(302, headers={'location': 'http://internal.test/admin'})

        raise AssertionError('the redirect must not be followed')

    dns = public_dns({'internal.test': ['10.0.0.5']})

    assert fetch_error(make_fetcher(handler, resolve=dns)) == PRIVATE_ADDRESS


def test_a_redirect_to_another_scheme_is_refused():
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={'location': 'file:///etc/passwd'})

    assert fetch_error(make_fetcher(handler)) == NOT_WEB_ADDRESS


def test_a_site_that_does_not_exist_says_so():
    def no_such_host(host: str, port: int) -> list[str]:
        raise socket.gaierror(socket.EAI_NONAME, 'not known')

    fetcher = make_fetcher(lambda _: html(ARTICLE), resolve=no_such_host)

    assert fetch_error(fetcher) == SITE_NOT_FOUND


@pytest.mark.parametrize(
    ('status', 'message'),
    [
        (401, NEEDS_LOGIN),
        (403, NEEDS_LOGIN),
        (404, REMOVED),
        (410, REMOVED),
        (429, RATE_LIMITED),
        (500, SITE_ERROR),
        (503, SITE_ERROR),
        (418, 'The site answered with an error (HTTP 418).'),
    ],
)
def test_an_error_status_fails_with_a_readable_reason(status: int, message: str):
    fetcher = make_fetcher(lambda _: html('<p>nope</p>', status=status))

    assert fetch_error(fetcher) == message


@pytest.mark.parametrize('content_type', ['application/pdf', 'image/png', ''])
def test_a_link_that_is_not_text_fails(content_type: str):
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, content=b'%PDF-1.7', headers={'content-type': content_type}
        )

    assert fetch_error(make_fetcher(handler)) == NOT_TEXT


def test_a_page_with_no_readable_text_fails():
    shell = (
        '<html><head><title>App</title></head><body><div id="root"></div></body></html>'
    )

    assert fetch_error(make_fetcher(lambda _: html(shell))) == NO_TEXT


def test_a_page_over_the_size_cap_fails():
    huge = '<p>' + 'a' * (MAX_PAGE_BYTES + 1) + '</p>'

    assert fetch_error(make_fetcher(lambda _: html(huge))) == TOO_LARGE


def test_a_timeout_fails_with_a_reason():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout('slow', request=request)

    assert fetch_error(make_fetcher(handler)) == TIMED_OUT


def test_a_refused_connection_fails_with_a_reason():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError('refused', request=request)

    assert fetch_error(make_fetcher(handler)) == UNREACHABLE


def test_the_deadline_covers_the_whole_fetch_including_redirects():
    now = [0.0]

    def clock() -> float:
        return now[0]

    def handler(_: httpx.Request) -> httpx.Response:
        # Each hop is quick, but together they run past the deadline.
        now[0] += FETCH_DEADLINE_SECONDS / 2 + 0.1
        return httpx.Response(302, headers={'location': '/next'})

    assert fetch_error(make_fetcher(handler, clock=clock)) == TIMED_OUT


def test_only_global_addresses_count_as_public():
    assert is_public_address('8.8.8.8')
    assert is_public_address('2606:4700::1111')
    assert not is_public_address('224.0.0.1')
