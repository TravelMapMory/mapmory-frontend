import { expect, test, type APIRequestContext } from '@playwright/test'
import { toTripDetail } from '../../src/api/adapters'
import type { ApiTrip } from '../../src/api/contract'

const base = process.env.MAPMORY_TEST_API_URL?.replace(/\/$/, '')
const tokenA = process.env.MAPMORY_TEST_ID_TOKEN
const tokenB = process.env.MAPMORY_TEST_OTHER_ID_TOKEN

const auth = (token: string) => ({
  Authorization: `Bearer ${token}`,
})

async function createTrip(
  request: APIRequestContext,
  token: string,
): Promise<ApiTrip> {
  const title = `PATCH integration ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const response = await request.post(`${base}/api/trips`, {
    headers: auth(token),
    data: { title, notes: 'Original notes' },
  })

  expect(response.status()).toBe(201)
  return (await response.json()) as ApiTrip
}

async function getTrip(
  request: APIRequestContext,
  token: string,
  id: string,
): Promise<ApiTrip> {
  const response = await request.get(`${base}/api/trips/${id}`, {
    headers: auth(token),
  })

  expect(response.status()).toBe(200)
  return (await response.json()) as ApiTrip
}

test('PATCH updates only supplied fields and persists the result', async ({
  request,
}) => {
  test.skip(!base || !tokenA, 'Live backend and Firebase token required')

  const original = await createTrip(request, tokenA!)

  const rename = await request.patch(`${base}/api/trips/${original.id}`, {
    headers: auth(tokenA!),
    data: { title: '  Updated title  ' },
  })

  expect(rename.status()).toBe(200)
  expect(await rename.json()).toMatchObject({
    id: original.id,
    title: 'Updated title',
    notes: 'Original notes',
    created_at: original.created_at,
  })

  const updateNotes = await request.patch(
    `${base}/api/trips/${original.id}`,
    {
      headers: auth(tokenA!),
      data: { notes: '  Updated notes  ' },
    },
  )

  expect(updateNotes.status()).toBe(200)
  expect(await updateNotes.json()).toMatchObject({
    title: 'Updated title',
    notes: 'Updated notes',
  })

  const clearNotes = await request.patch(
    `${base}/api/trips/${original.id}`,
    {
      headers: auth(tokenA!),
      data: { notes: '' },
    },
  )

  expect(clearNotes.status()).toBe(200)

  const updated = await getTrip(request, tokenA!, original.id)

  expect(updated).toMatchObject({
    id: original.id,
    title: 'Updated title',
    notes: '',
    created_at: original.created_at,
    photo_count: 0,
    cover: null,
  })

  expect(toTripDetail(updated)).toMatchObject({
    id: original.id,
    title: 'Updated title',
    notes: null,
    cover_photo_id: null,
    cover_url: null,
    cover_expires_at: null,
  })
})

test('invalid PATCH requests do not modify the trip', async ({
  request,
}) => {
  test.skip(!base || !tokenA, 'Live backend and Firebase token required')

  const original = await createTrip(request, tokenA!)

  const invalidCases = [
    { name: 'empty object', body: {} },
    { name: 'blank title', body: { title: '   ' } },
    { name: 'title too long', body: { title: 'a'.repeat(121) } },
    { name: 'notes too long', body: { notes: 'a'.repeat(2001) } },
    { name: 'null title', body: { title: null } },
    { name: 'null notes', body: { notes: null } },
    { name: 'wrong type', body: { notes: 42 } },
    { name: 'unknown field', body: { visibility: 'public' } },
    { name: 'owner injection', body: { owner_id: crypto.randomUUID() } },
  ]

  for (const { name, body } of invalidCases) {
    const response = await request.patch(
      `${base}/api/trips/${original.id}`,
      {
        headers: auth(tokenA!),
        data: body,
      },
    )

    expect(response.status(), name).toBe(400)
    expect(await response.json(), name).toMatchObject({
      error: { code: 'invalid_request' },
    })
  }

  const persisted = await getTrip(request, tokenA!, original.id)

  expect(persisted.title).toBe(original.title)
  expect(persisted.notes).toBe(original.notes)
  expect(persisted.created_at).toBe(original.created_at)
})

test('PATCH requires authentication and returns 404 for unknown trips', async ({
  request,
}) => {
  test.skip(!base || !tokenA, 'Live backend and Firebase token required')

  const original = await createTrip(request, tokenA!)

  const noAuth = await request.patch(
    `${base}/api/trips/${original.id}`,
    { data: { title: 'Unauthorized edit' } },
  )
  expect(noAuth.status()).toBe(401)

  const unknown = await request.patch(
    `${base}/api/trips/00000000-0000-4000-8000-000000000000`,
    {
      headers: auth(tokenA!),
      data: { title: 'Missing trip' },
    },
  )
  expect(unknown.status()).toBe(404)
  expect(await unknown.json()).toMatchObject({
    error: { code: 'not_found' },
  })

  const persisted = await getTrip(request, tokenA!, original.id)
  expect(persisted.title).toBe(original.title)
})

test('two Firebase users cannot PATCH each other\'s trips', async ({
  request,
}) => {
  test.skip(
    !base || !tokenA || !tokenB,
    'Requires backend and two Firebase ID tokens',
  )

  const [meA, meB] = await Promise.all([
    request.get(`${base}/api/users/me`, { headers: auth(tokenA!) }),
    request.get(`${base}/api/users/me`, { headers: auth(tokenB!) }),
  ])

  expect(meA.status()).toBe(200)
  expect(meB.status()).toBe(200)

  const userA = (await meA.json()) as { id: string }
  const userB = (await meB.json()) as { id: string }

  expect(userA.id).toBeTruthy()
  expect(userB.id).toBeTruthy()
  expect(userA.id).not.toBe(userB.id)

  const tripA = await createTrip(request, tokenA!)
  const tripB = await createTrip(request, tokenB!)

  const [aEditsB, bEditsA] = await Promise.all([
    request.patch(`${base}/api/trips/${tripB.id}`, {
      headers: auth(tokenA!),
      data: { title: 'Unauthorized A edit' },
    }),
    request.patch(`${base}/api/trips/${tripA.id}`, {
      headers: auth(tokenB!),
      data: { notes: 'Unauthorized B edit' },
    }),
  ])

  expect(aEditsB.status()).toBe(404)
  expect(bEditsA.status()).toBe(404)

  for (const response of [aEditsB, bEditsA]) {
    expect(await response.json()).toMatchObject({
      error: { code: 'not_found' },
    })
  }

  const [persistedA, persistedB] = await Promise.all([
    getTrip(request, tokenA!, tripA.id),
    getTrip(request, tokenB!, tripB.id),
  ])

  expect(persistedA.title).toBe(tripA.title)
  expect(persistedA.notes).toBe(tripA.notes)
  expect(persistedB.title).toBe(tripB.title)
  expect(persistedB.notes).toBe(tripB.notes)
})
