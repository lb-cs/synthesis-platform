/**
 * The web address of a link source (UC-12). Pure and client-safe, so the Add link form
 * and the server action check and store the same thing.
 */

const MAX_URL_LENGTH = 2048;
const TITLE_MAX_LENGTH = 200;

const EXAMPLE_ADDRESS = 'https://example.com';

// Letters, digits, and hyphens in two or more dot-separated labels. `new URL` has already
// turned international names into this ASCII form.
const HOSTNAME_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

export type LinkUrlResult = { ok: true; url: string } | { ok: false; message: string };

function fail(message: string): LinkUrlResult {
  return { ok: false, message };
}

// `new URL` throws on a bad address; `URL.parse` is too new for some browsers.
function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * Checks a typed address and returns the form to store: `https://` added when the user
 * left it off, and the host lowercased. Rejects anything that is not a public web page
 * address, since the worker fetches it from the server.
 */
export function normalizeLinkUrl(input: string): LinkUrlResult {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return fail('Enter a link.');
  }

  const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
  const parsed = parseUrl(withScheme);

  if (!parsed) {
    return fail(`This is not a web address. Try something like ${EXAMPLE_ADDRESS}.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return fail('Only http and https links can be added.');
  }

  if (parsed.username !== '' || parsed.password !== '') {
    return fail('Remove the username and password from the link.');
  }

  const isNamedHost =
    HOSTNAME_PATTERN.test(parsed.hostname) && !IPV4_PATTERN.test(parsed.hostname);

  if (!isNamedHost) {
    return fail(`Enter a full web address, like ${EXAMPLE_ADDRESS}.`);
  }

  if (parsed.href.length > MAX_URL_LENGTH) {
    return fail('This link is too long.');
  }

  return { ok: true, url: parsed.href };
}

/** A starting title for a link: its host without `www.`. The user can rename it. */
export function getLinkTitle(url: string): string {
  const parsed = parseUrl(url);
  const host = parsed?.hostname ?? url;

  return host.replace(/^www\./i, '').slice(0, TITLE_MAX_LENGTH);
}
