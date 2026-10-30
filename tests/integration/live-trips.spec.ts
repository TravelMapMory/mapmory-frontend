/** Run explicitly against local feat/trip-persistence; never included in the mock suite.
 * Required: MAPMORY_TEST_API_URL and MAPMORY_TEST_ID_TOKEN.
 * Optional: MAPMORY_TEST_OTHER_ID_TOKEN (a different Firebase user).
 * Creates one persistent trip; no delete endpoint exists yet.
 */
import { expect, test } from '@playwright/test'
import { toTripDetail, toTripPage, toTripSummary } from '../../src/api/adapters'
import type { ApiTrip, ApiPage } from '../../src/api/contract'

const base = process.env.MAPMORY_TEST_API_URL?.replace(/\/$/, '')
const token = process.env.MAPMORY_TEST_ID_TOKEN
const other = process.env.MAPMORY_TEST_OTHER_ID_TOKEN

test('live trip contract, persistence, ownership, and error paths', async ({ request }) => {
  test.skip(!base || !token, 'Set MAPMORY_TEST_API_URL and MAPMORY_TEST_ID_TOKEN')
  const root = base!
  const headers = { Authorization: `Bearer ${token}` }
  const uniqueTitle = `PR38 contract ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const create = await request.post(`${root}/api/trips`, { headers, data: { title: `  ${uniqueTitle}  `, notes: 'adapter check' } })
  expect(create.status()).toBe(201)
  const created = (await create.json()) as ApiTrip
  expect(created).toEqual(expect.objectContaining({
    id: expect.any(String), title: uniqueTitle, notes: 'adapter check',
    created_at: expect.any(String), photo_count: 0, cover: null,
  }))
  expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i)
  expect(Number.isNaN(Date.parse(created.created_at))).toBe(false)
  expect(toTripSummary(created)).toMatchObject({ title: uniqueTitle, notes: 'adapter check', visibility: 'private', located_count: 0 })
  const detail = await request.get(`${root}/api/trips/${encodeURIComponent(created.id)}`, { headers })
  expect(detail.status()).toBe(200)
  expect(toTripDetail(await detail.json())).toMatchObject({ id: created.id, title: uniqueTitle, cover_photo_id: null })
  const list = await request.get(`${root}/api/trips`, { headers })
  expect(list.status()).toBe(200)
  const page = (await list.json()) as ApiPage<ApiTrip>
  expect(page.next_cursor).toBeNull() // Current backend: pagination is not implemented yet.
  expect(toTripPage(page).items.some((t) => t.id === created.id)).toBe(true)
  const noAuth = await request.get(`${root}/api/trips`)
  expect(noAuth.status()).toBe(401)
  const invalid = await request.post(`${root}/api/trips`, { headers, data: { title: '  ' } })
  expect(invalid.status()).toBe(400)
  expect(await invalid.json()).toMatchObject({ error: { code: 'invalid_request' } })
  const unknown = await request.get(`${root}/api/trips/00000000-0000-4000-8000-000000000000`, { headers })
  expect(unknown.status()).toBe(404)
  expect(await unknown.json()).toMatchObject({ error: { code: 'not_found' } })
  if (other) {
    const otherHeaders = { Authorization: `Bearer ${other}` }
    const foreign = await request.get(`${root}/api/trips/${created.id}`, { headers: otherHeaders })
    expect(foreign.status()).toBe(404)
    const foreignList = await request.get(`${root}/api/trips`, { headers: otherHeaders })
    expect(foreignList.status()).toBe(200)
    expect(((await foreignList.json()) as ApiPage<ApiTrip>).items.some((t) => t.id === created.id)).toBe(false)
  }
})
