// The Analysis routes answer errors as { error } JSON, and useChat's transport hands
// that body over as the error's message. Show the route's sentence when there is one.
export function getRequestErrorMessage(error: Error, fallback: string): string {
  try {
    const body: { error?: unknown } = JSON.parse(error.message);

    return typeof body.error === 'string' ? body.error : fallback;
  } catch {
    return fallback;
  }
}
