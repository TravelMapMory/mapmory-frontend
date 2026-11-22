/**
 * Live API integration tests for backend feat/trip-persistence.
 *
 * Required: MAPMORY_TEST_API_URL, MAPMORY_TEST_ID_TOKEN
 * For isolation: MAPMORY_TEST_OTHER_ID_TOKEN (a distinct Firebase account)
 *
 * Tests create persistent development trips. Run only against a disposable
 * development database; trip deletion is not implemented yet.
 */
import { expect, test, type APIRequestContext } from '@playwright/test'
import { toTripDetail, toTripPage, toTripSummary } from '../../src/api/adapters'
import type { ApiPage, ApiTrip } from '../../src/api/contract'

const base = process.env.MAPMORY_TEST_API_URL?.replace(/\/$/, '')
const tokenA = process.env.MAPMORY_TEST_ID_TOKEN
const tokenB = process.env.MAPMORY_TEST_OTHER_ID_TOKEN

type AuthHeaders = { Authorization: string }
const auth = (token: string): AuthHeaders => ({ Authorization: `Bearer ${token}` })

async function createTrip(
  request: APIRequestContext,
  root: string,
  token: string,
  label: string,
): Promise<ApiTrip> {
  const title = `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const response = await request.post(`${root}/api/trips`, {
    headers: auth(token),
    data: { title: `  ${title}  `, notes: 'integration check' },
  })
  expect(response.status(), `Create ${label} trip`).toBe(201)
  const trip = (await response.json()) as ApiTrip
  expect(trip.title).toBe(title)
  return trip
}

async function listTripIds(
  request: APIRequestContext,
  root: string,
  token: string,
): Promise<string[]> {
  const response = await request.get(`${root}/api/trips`, { headers: auth(token) })
  expect(response.status()).toBe(200)
  const page = (await response.json()) as ApiPage<ApiTrip>
  // Current trip-persistence backend returns all trips without pagination.
  expect(page.next_cursor).toBeNull()
  return page.items.map((trip) => trip.id)
}

test('trip creation, retrieval, listing, and adapters use the live API', async ({ request }) => {
  test.skip(!base || !tokenA, 'Requires MAPMORY_TEST_API_URL and MAPMORY_TEST_ID_TOKEN')
  const root = base!
  const trip = await createTrip(request, root, tokenA!, 'PR38 contract')

  expect(trip).toEqual(expect.objectContaining({
    id: expect.any(String),
    notes: 'integration check',
    created_at: expect.any(String),
    photo_count: 0,
    cover: null,
  }))
  expect(trip.id).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i)
  expect(Number.isNaN(Date.parse(trip.created_at))).toBe(false)
  expect(toTripSummary(trip)).toMatchObject({
    title: trip.title, notes: 'integration check', visibility: 'private', located_count: 0,
  })

  const detail = await request.get(`${root}/api/trips/${trip.id}`, { headers: auth(tokenA!) })
  expect(detail.status()).toBe(200)
  expect(toTripDetail(await detail.json())).toMatchObject({
    id: trip.id, title: trip.title, cover_photo_id: null,
  })

  const list = await request.get(`${root}/api/trips`, { headers: auth(tokenA!) })
  expect(list.status()).toBe(200)
  const page = (await list.json()) as ApiPage<ApiTrip>
  expect(page.next_cursor).toBeNull()
  expect(toTripPage(page).items.some((item) => item.id === trip.id)).toBe(true)
})

test('unauthenticated, invalid, and nonexistent trip requests are rejected', async ({ request }) => {
  test.skip(!base || !tokenA, 'Requires MAPMORY_TEST_API_URL and MAPMORY_TEST_ID_TOKEN')
  const root = base!

  const noAuth = await request.get(`${root}/api/trips`)
  expect(noAuth.status()).toBe(401)

  const invalid = await request.post(`${root}/api/trips`, {
    headers: auth(tokenA!), data: { title: '  ' },
  })
  expect(invalid.status()).toBe(400)
  expect(await invalid.json()).toMatchObject({ error: { code: 'invalid_request' } })

  const unknown = await request.get(
    `${root}/api/trips/00000000-0000-4000-8000-000000000000`,
    { headers: auth(tokenA!) },
  )
  expect(unknown.status()).toBe(404)
  expect(await unknown.json()).toMatchObject({ error: { code: 'not_found' } })
})

test('two Firebase users cannot list or retrieve each other\'s private trips', async ({ request }) => {
  test.skip(
    !base || !tokenA || !tokenB,
    'Requires MAPMORY_TEST_API_URL and two Firebase ID tokens',
  )
  const root = base!

  // Ensure we really have two different application users.
  const [meA, meB] = await Promise.all([
    request.get(`${root}/api/users/me`, { headers: auth(tokenA!) }),
    request.get(`${root}/api/users/me`, { headers: auth(tokenB!) }),
  ])
  expect(meA.status()).toBe(200)
  expect(meB.status()).toBe(200)
  const identityA = (await meA.json()) as { id: string }
  const identityB = (await meB.json()) as { id: string }
  expect(identityA.id).toBeTruthy()
  expect(identityB.id).toBeTruthy()
  expect(identityA.id, 'The two test tokens must belong to different users').not.toBe(identityB.id)

  const tripA = await createTrip(request, root, tokenA!, 'PR38 account A')
  const tripB = await createTrip(request, root, tokenB!, 'PR38 account B')

  // Each owner sees their own trip, but not the other owner's trip.
  const [idsA, idsB] = await Promise.all([
    listTripIds(request, root, tokenA!),
    listTripIds(request, root, tokenB!),
  ])
  expect(idsA).toContain(tripA.id)
  expect(idsA).not.toContain(tripB.id)
  expect(idsB).toContain(tripB.id)
  expect(idsB).not.toContain(tripA.id)

  // Knowing a foreign trip UUID must not grant access to its details.
  const [aReadsB, bReadsA] = await Promise.all([
    request.get(`${root}/api/trips/${tripB.id}`, { headers: auth(tokenA!) }),
    request.get(`${root}/api/trips/${tripA.id}`, { headers: auth(tokenB!) }),
  ])
  expect(aReadsB.status()).toBe(404)
  expect(bReadsA.status()).toBe(404)
  expect(await aReadsB.json()).toMatchObject({ error: { code: 'not_found' } })
  expect(await bReadsA.json()).toMatchObject({ error: { code: 'not_found' } })
})
