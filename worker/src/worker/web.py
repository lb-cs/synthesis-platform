"""
Fetches a link source's web page and pulls out its readable text (CECS491-85). Anything
that stops the page from being read raises FetchError, whose message is safe to show the
user.

The worker runs inside the hosting network, so a link must never reach an internal
address. Every hop (the first request and each redirect) resolves the host, refuses it
unless every address is public, and then connects to the address it checked, not to the
name again. Resolving twice would let a hostile DNS server answer "public" for the check
and "private" for the connection (DNS rebinding).
"""

import ipaddress
import socket
import time
from collections.abc import Callable
from dataclasses import dataclass

import httpx
import trafilatura

from worker.parsing import clean

# The whole fetch, redirects included. A typical page arrives in well under a second.
FETCH_DEADLINE_SECONDS = 10.0
MAX_REDIRECTS = 5
# Readable text is a small part of a page; past this it is a download, not an article.
MAX_PAGE_BYTES = 5 * 1024 * 1024
TITLE_MAX_LENGTH = 300

HTML_TYPES = frozenset({'text/html', 'application/xhtml+xml'})
PLAIN_TEXT_TYPE = 'text/plain'
REDIRECT_STATUS_CODES = frozenset({301, 302, 303, 307, 308})
DEFAULT_PORTS = {'http': 80, 'https': 443}

# Name the client and a contact URL. Some sites (Wikipedia among them) refuse a request
# whose User-Agent has no way to reach its owner.
USER_AGENT = (
    'SynthesisPlatform/1.0 (+https://github.com/lb-cs/synthesis-platform) '
    f'python-httpx/{httpx.__version__}'
)

# Written to sources.processing_error, which the sources page shows the user.
NOT_WEB_ADDRESS = 'Only http and https links can be read.'
SITE_NOT_FOUND = 'This site could not be found. Check the link and add it again.'
PRIVATE_ADDRESS = (
    'This link points to a private or local network address, so it was not read.'
)
UNREACHABLE = 'The site could not be reached. Retry processing in a few minutes.'
TIMED_OUT = 'The page took too long to load. Retry processing in a few minutes.'
TOO_MANY_REDIRECTS = 'This link redirects too many times to read.'
NEEDS_LOGIN = (
    'This page needs a login or blocks automated access, so it could not be read.'
)
REMOVED = 'This page was not found. It may have been moved or removed.'
RATE_LIMITED = (
    'The site is limiting requests right now. Retry processing in a few minutes.'
)
SITE_ERROR = 'The site had an error loading this page. Retry processing later.'
TOO_LARGE = 'This page is too large to read.'
NOT_TEXT = (
    'This link is not a web page with text. If it is a file such as a PDF, download it '
    'and upload the file instead.'
)
NO_TEXT = (
    'No readable text was found on this page. It may need a login or JavaScript to show '
    'its content.'
)

ERROR_BY_STATUS = {
    401: NEEDS_LOGIN,
    403: NEEDS_LOGIN,
    407: NEEDS_LOGIN,
    404: REMOVED,
    410: REMOVED,
    429: RATE_LIMITED,
}

# Host and port to the addresses it resolves to.
Resolver = Callable[[str, int], list[str]]


class FetchError(Exception):
    """The page can't be read. The message is shown to the user."""


@dataclass(frozen=True)
class WebPage:
    # Where the page was read from, after redirects.
    url: str
    title: str | None
    text: str


def resolve_host(host: str, port: int) -> list[str]:
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)

    # dict.fromkeys de-duplicates and keeps the resolver's order of preference.
    return list(dict.fromkeys(str(info[4][0]) for info in infos))


def is_public_address(address: str) -> bool:
    """False for loopback, private, link-local (cloud metadata), and reserved ranges."""
    ip = ipaddress.ip_address(address)

    return ip.is_global and not ip.is_multicast


def new_client() -> httpx.Client:
    # Requests go to an IP address, so httpx pools connections by address, not by name.
    # A kept-alive connection opened for one site (its SNI and certificate) would be
    # reused for another site on the same address, so every request gets its own.
    no_keep_alive = httpx.Limits(max_keepalive_connections=0)

    # Redirects are followed by hand so each hop's address is checked.
    return httpx.Client(follow_redirects=False, limits=no_keep_alive)


class PageFetcher:
    def __init__(
        self,
        client: httpx.Client | None = None,
        resolve: Resolver = resolve_host,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._client = client or new_client()
        self._resolve = resolve
        self._clock = clock

    def fetch(self, url: str) -> WebPage:
        deadline = self._clock() + FETCH_DEADLINE_SECONDS
        current = httpx.URL(url)

        for _ in range(MAX_REDIRECTS + 1):
            response = self._open(current, deadline)

            # A streamed response holds its connection until closed.
            try:
                location = response.headers.get('location')
                is_redirect = response.status_code in REDIRECT_STATUS_CODES

                if not is_redirect or not location:
                    return self._read(current, response, deadline)
            finally:
                response.close()

            current = current.join(location)

        raise FetchError(TOO_MANY_REDIRECTS)

    def _open(self, url: httpx.URL, deadline: float) -> httpx.Response:
        if url.scheme not in DEFAULT_PORTS:
            raise FetchError(NOT_WEB_ADDRESS)

        # raw_host is the ASCII (punycode) form that DNS, Host, and SNI all expect.
        host = url.raw_host.decode('ascii')
        port = url.port or DEFAULT_PORTS[url.scheme]
        address = self._public_address(host, port)
        host_header = host if url.port is None else f'{host}:{url.port}'

        request = self._client.build_request(
            'GET',
            url.copy_with(host=address),
            headers={'Host': host_header, 'User-Agent': USER_AGENT},
            # TLS checks the certificate against the real name, not the address.
            extensions={'sni_hostname': host},
            timeout=self._remaining(deadline),
        )

        try:
            return self._client.send(request, stream=True)
        except httpx.TimeoutException as error:
            raise FetchError(TIMED_OUT) from error
        except httpx.TransportError as error:
            raise FetchError(UNREACHABLE) from error

    def _public_address(self, host: str, port: int) -> str:
        try:
            addresses = self._resolve(host, port)
        except (socket.gaierror, UnicodeError) as error:
            raise FetchError(SITE_NOT_FOUND) from error

        if not addresses:
            raise FetchError(SITE_NOT_FOUND)

        # All of them, not just the first: a name with one private address is refused.
        if not all(is_public_address(address) for address in addresses):
            raise FetchError(PRIVATE_ADDRESS)

        return addresses[0]

    def _read(self, url: httpx.URL, response: httpx.Response, deadline: float) -> WebPage:
        check_status(response.status_code)
        content_type = get_content_type(response)

        if content_type not in HTML_TYPES and content_type != PLAIN_TEXT_TYPE:
            raise FetchError(NOT_TEXT)

        body = self._read_body(response, deadline)

        if content_type == PLAIN_TEXT_TYPE:
            text = clean(body.decode(response.encoding or 'utf-8', errors='replace'))
            return to_web_page(url, title=None, text=text)

        document = trafilatura.bare_extraction(
            body, url=str(url), with_metadata=True, include_comments=False
        )

        if document is None:
            raise FetchError(NO_TEXT)

        return to_web_page(url, title=document.title, text=clean(document.text or ''))

    def _read_body(self, response: httpx.Response, deadline: float) -> bytes:
        body = bytearray()

        try:
            for piece in response.iter_bytes():
                body.extend(piece)

                if len(body) > MAX_PAGE_BYTES:
                    raise FetchError(TOO_LARGE)

                if self._clock() > deadline:
                    raise FetchError(TIMED_OUT)
        except httpx.TimeoutException as error:
            raise FetchError(TIMED_OUT) from error
        except httpx.TransportError as error:
            raise FetchError(UNREACHABLE) from error

        return bytes(body)

    def _remaining(self, deadline: float) -> float:
        remaining = deadline - self._clock()

        if remaining <= 0:
            raise FetchError(TIMED_OUT)

        return remaining


def check_status(status_code: int) -> None:
    if 200 <= status_code < 300:
        return

    known = ERROR_BY_STATUS.get(status_code)

    if known is not None:
        raise FetchError(known)

    if status_code >= 500:
        raise FetchError(SITE_ERROR)

    raise FetchError(f'The site answered with an error (HTTP {status_code}).')


def get_content_type(response: httpx.Response) -> str:
    header = response.headers.get('content-type', '')

    return header.split(';')[0].strip().lower()


def to_web_page(url: httpx.URL, title: str | None, text: str) -> WebPage:
    if not text:
        raise FetchError(NO_TEXT)

    tidy_title = clean(title or '')[:TITLE_MAX_LENGTH]

    return WebPage(url=str(url), title=tidy_title or None, text=text)
