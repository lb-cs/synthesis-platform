/**
 * What went wrong with a question, in words the user can act on (UC-16 E2, E3). The chat
 * route answers errors as `{ error, code }`; the Ask panel turns whatever it caught into
 * one of these. Pure and client-safe, so the route and the panel share the same words.
 */

// What the route can name. Anything else it sends has only an `error` message.
export const CHAT_ERROR_CODES = [
  'no-sources',
  'sources-processing',
  'ai-unavailable',
] as const;

export type ChatErrorCode = (typeof CHAT_ERROR_CODES)[number];
export type ChatErrorKind = ChatErrorCode | 'connection' | 'unknown';

export const CHAT_ERROR_MESSAGES: Record<ChatErrorKind, string> = {
  'no-sources': 'Add a source to this project before asking.',
  'sources-processing':
    'Your sources are still being processed. Try again once one shows Ready.',
  'ai-unavailable': 'The AI service is unavailable right now. Try again in a moment.',
  connection: 'Lost connection. Check your internet, then try again.',
  unknown: 'Something went wrong. Try again.',
};

export type ChatErrorInfo = {
  kind: ChatErrorKind;
  message: string;
  /** False when sending the same question again cannot help. */
  canRetry: boolean;
};

function isChatErrorCode(value: unknown): value is ChatErrorCode {
  return CHAT_ERROR_CODES.some((code) => code === value);
}

// The transport hands a failed response over as its raw body, so JSON comes back as text.
function readErrorBody(text: string): { error?: unknown; code?: unknown } | null {
  try {
    const body: unknown = JSON.parse(text);

    if (typeof body !== 'object' || body === null) {
      return null;
    }

    return body;
  } catch {
    return null;
  }
}

function fromKind(kind: ChatErrorKind): ChatErrorInfo {
  return { kind, message: CHAT_ERROR_MESSAGES[kind], canRetry: kind !== 'no-sources' };
}

/**
 * Picks the message for an error from `useChat`. A response from our route names its
 * cause; a stream that broke mid-answer carries the AI message; `fetch` rejects with a
 * TypeError when the network is gone. Anything else gets the plain fallback.
 */
export function describeChatError(error: Error, isOffline: boolean): ChatErrorInfo {
  const body = readErrorBody(error.message);

  if (isChatErrorCode(body?.code)) {
    return fromKind(body.code);
  }

  if (error.message === CHAT_ERROR_MESSAGES['ai-unavailable']) {
    return fromKind('ai-unavailable');
  }

  if (typeof body?.error === 'string') {
    return { kind: 'unknown', message: body.error, canRetry: true };
  }

  if (isOffline || error instanceof TypeError) {
    return fromKind('connection');
  }

  return fromKind('unknown');
}
