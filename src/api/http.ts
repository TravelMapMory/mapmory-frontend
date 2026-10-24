/*
 * The one place that talks to the Go backend over HTTP. Paths are relative
 * ("/api/trips"): in development Vite proxies /api to VITE_API_URL (see
 * vite.config.ts), in production the API is served from the same origin.
 */

/** The backend's error body (doc 5.2): `{ "error": { "code", "message" } }`. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/**
 * Returns the signed-in user's Firebase ID token, or null when signed out;
 * `forceRefresh` asks Firebase for a new one. src/auth.ts sets the real
 * provider; in demo mode requests go without a token.
 */
type TokenProvider = (forceRefresh: boolean) => Promise<string | null>
let tokenProvider: TokenProvider = async () => null
/** Called when the backend refuses even a refreshed token: the session is gone. */
let onUnauthorized: () => void = () => {}

export function setTokenProvider(provider: TokenProvider) {
  tokenProvider = provider
}

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

export interface RequestOptions {
  body?: unknown
  query?: Record<string, string | number | undefined | null>
  signal?: AbortSignal
}

function withQuery(path: string, query: RequestOptions['query']): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `${path}?${text}` : path
}

async function readError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } }
    if (body.error?.code) {
      return new ApiError(response.status, body.error.code, body.error.message ?? response.statusText)
    }
  } catch {
    // Not JSON, e.g. a proxy error page; fall through to the status line.
  }
  return new ApiError(response.status, 'http_error', `${response.status} ${response.statusText}`.trim())
}

async function send(method: string, path: string, options: RequestOptions, forceRefresh: boolean) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = await tokenProvider(forceRefresh)
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(withQuery(path, options.query), {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  })
  return { response, sentToken: Boolean(token) }
}

/**
 * Sends one request and returns the parsed JSON body. Rejects with ApiError
 * for non-2xx answers, and with the fetch AbortError when `signal` aborts.
 * A 401 on a signed request is retried once with a refreshed token; a second
 * 401 ends the session.
 */
export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  let { response, sentToken } = await send(method, path, options, false)
  if (response.status === 401 && sentToken) {
    ;({ response, sentToken } = await send(method, path, options, true))
    if (response.status === 401 && sentToken) onUnauthorized()
  }
  if (!response.ok) throw await readError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
