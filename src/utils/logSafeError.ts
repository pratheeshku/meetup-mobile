/**
 * Reduces a caught error to a short, log-safe tag (R-111).
 *
 * Axios errors carry the full request `config` — including the
 * `Authorization` header and request body — so an error object must never be
 * handed to `console.*` directly. This returns only an HTTP status, an
 * error code (e.g. `ECONNABORTED`, `ERR_NETWORK`) or the error name.
 */
interface ErrorLike {
  name?: unknown;
  code?: unknown;
  response?: { status?: unknown };
}

export function describeError(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'unknown';
  }
  const { response, code, name } = error as ErrorLike;
  const tag = response?.status ?? code ?? name;
  return typeof tag === 'string' || typeof tag === 'number' ? String(tag) : 'unknown';
}
