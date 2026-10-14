import { expect, test } from '@playwright/test'
import { toTripPage, toTripSummary, type ApiTrip } from '../../src/api/adapters'
import { ApiError, request, setTokenProvider } from '../../src/api/http'

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

  function answer(status: number, body: unknown) {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
    }) as typeof fetch
  }

  test.beforeEach(() => {
    calls = []
  })
  test.afterEach(() => {
    globalThis.fetch = realFetch
    setTokenProvider(async () => null)
  })

  test('sends JSON with the ID token and drops empty query values', async () => {
    answer(201, backendTrip)
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
    answer(200, { items: [], next_cursor: null })
    await request('GET', '/api/trips')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  test('the backend error body becomes an ApiError with its code', async () => {
    answer(400, { error: { code: 'invalid_request', message: 'title must not be blank' } })
    const error = await request('POST', '/api/trips', { body: { title: ' ' } }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, code: 'invalid_request', message: 'title must not be blank' })
  })

  test('a non-JSON failure still becomes an ApiError', async () => {
    answer(502, '<html>Bad gateway</html>')
    const error = await request('GET', '/api/trips').catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 502, code: 'http_error' })
  })
})
