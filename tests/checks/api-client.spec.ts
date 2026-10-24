import { expect, test } from '@playwright/test'
import { toTripDetail, toTripPage, toTripSummary, type ApiTrip } from '../../src/api/adapters'
import { ApiError, request, setTokenProvider, setUnauthorizedHandler } from '../../src/api/http'
import { authErrorMessage } from '../../src/authErrors'

// Exactly what mapmory-backend's POST /api/trips returns today.
const backendTrip: ApiTrip = {
  id: '6f1c0f62-4c1e-4a59-9a43-6b2f0a3e8c11',
  title: 'Kyoto autumn',
  notes: '',
  created_at: '2026-10-14T10:00:00Z',
  photo_count: 0,
  cover: null,
}

test('a backend trip becomes a private trip card with neutral aggregates', () => {
  expect(toTripSummary(backendTrip)).toEqual({
    id: backendTrip.id,
    title: 'Kyoto autumn',
    notes: null,
    created_at: '2026-10-14T10:00:00Z',
    cover_url: null,
    photo_count: 0,
    located_count: 0,
    cities: [],
    countries: [],
    start_date: null,
    end_date: null,
    visibility: 'private',
  })
})

test('a cover image and later contract fields pass through, and page order is kept', () => {
  const withCover: ApiTrip = {
    ...backendTrip,
    id: 'b',
    notes: 'Temples',
    cover: { photo_id: 'p1', image: { url: 'https://example.test/c.jpg', expires_at: '2026-10-14T11:00:00Z' } },
    cities: ['Kyoto'],
    countries: ['Japan'],
  }
  const page = toTripPage({ items: [backendTrip, withCover], next_cursor: 'next' })
  expect(page.items.map((trip) => trip.id)).toEqual([backendTrip.id, 'b'])
  expect(page.next_cursor).toBe('next')
  expect(page.items[1]).toMatchObject({ notes: 'Temples', cover_url: 'https://example.test/c.jpg', cities: ['Kyoto'] })
})

test.describe('request', () => {
  const realFetch = globalThis.fetch
  let calls: { url: string; init: RequestInit }[] = []

  function answer(...replies: [status: number, body: unknown][]) {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      const [status, body] = replies[Math.min(calls.length, replies.length) - 1]
      return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
    }) as typeof fetch
  }
  const authHeader = (call: number) => (calls[call].init.headers as Record<string, string>).Authorization
  const unauthorized = { error: { code: 'unauthorized', message: 'authentication required' } }

  test.beforeEach(() => {
    calls = []
  })
  test.afterEach(() => {
    globalThis.fetch = realFetch
    setTokenProvider(async () => null)
    setUnauthorizedHandler(() => {})
  })

  test('sends JSON with the ID token and drops empty query values', async () => {
    answer([201, backendTrip])
    setTokenProvider(async () => 'token-123')
    const created = await request('POST', '/api/trips', { body: { title: 'Kyoto autumn' }, query: { a: 1, b: '', c: undefined } })
    expect(created).toEqual(backendTrip)
    expect(calls[0].url).toBe('/api/trips?a=1')
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token-123')
    expect(headers['Content-Type']).toBe('application/json')
    expect(calls[0].init.body).toBe('{"title":"Kyoto autumn"}')
  })

  test('sends no Authorization header while signed out', async () => {
    answer([200, { items: [], next_cursor: null }])
    await request('GET', '/api/trips')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  test('the backend error body becomes an ApiError with its code', async () => {
    answer([400, { error: { code: 'invalid_request', message: 'title must not be blank' } }])
    const error = await request('POST', '/api/trips', { body: { title: ' ' } }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, code: 'invalid_request', message: 'title must not be blank' })
  })

  test('a 401 is retried once with a refreshed token', async () => {
    answer([401, unauthorized], [200, { uid: 'u1' }])
    setTokenProvider(async (force) => (force ? 'fresh' : 'stale'))
    let lost = false
    setUnauthorizedHandler(() => (lost = true))
    expect(await request('GET', '/api/auth/me')).toEqual({ uid: 'u1' })
    expect([authHeader(0), authHeader(1)]).toEqual(['Bearer stale', 'Bearer fresh'])
    expect(lost).toBe(false)
  })

  test('a second 401 ends the session without looping', async () => {
    answer([401, unauthorized])
    setTokenProvider(async () => 'revoked')
    let lost = 0
    setUnauthorizedHandler(() => lost++)
    const error = await request('GET', '/api/auth/me').catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 401, code: 'unauthorized' })
    expect(calls).toHaveLength(2)
    expect(lost).toBe(1)
  })

  test('a signed-out 401 and server errors are not retried as auth failures', async () => {
    answer([401, unauthorized])
    await request('GET', '/api/auth/me').catch(() => null)
    expect(calls).toHaveLength(1)
    calls = []
    answer([500, { error: { code: 'internal', message: 'boom' } }])
    setTokenProvider(async () => 'token')
    await expect(request('GET', '/api/trips')).rejects.toMatchObject({ status: 500 })
    expect(calls).toHaveLength(1)
  })

  test('a failure to get the token rejects without sending the request', async () => {
    answer([200, {}])
    setTokenProvider(async () => {
      throw Object.assign(new Error('offline'), { code: 'auth/network-request-failed' })
    })
    await expect(request('GET', '/api/trips')).rejects.toMatchObject({ code: 'auth/network-request-failed' })
    expect(calls).toHaveLength(0)
  })

  test('a non-JSON failure still becomes an ApiError', async () => {
    answer([502, '<html>Bad gateway</html>'])
    const error = await request('GET', '/api/trips').catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 502, code: 'http_error' })
  })
})

test('backend trip detail preserves the server ID and supports an empty gallery', () => {
  expect(toTripDetail(backendTrip)).toMatchObject({
    id: backendTrip.id, title: backendTrip.title, cover_photo_id: null, photo_count: 0,
  })
})

test('Firebase sign-in errors become plain messages without codes', () => {
  expect(authErrorMessage({ code: 'auth/invalid-credential' })).toBe('Email or password is incorrect.')
  expect(authErrorMessage({ code: 'auth/email-already-in-use' })).toContain('Log in instead')
  expect(authErrorMessage({ code: 'auth/weak-password' })).toContain('6 characters')
  expect(authErrorMessage({ code: 'auth/network-request-failed' })).toContain('connection')
  expect(authErrorMessage(new Error('auth/internal-error: debug details'))).toBe('Something went wrong. Please try again.')
})
