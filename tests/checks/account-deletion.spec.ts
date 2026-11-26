import { expect, test } from '@playwright/test'
import { completeAccountDeletion } from '../../src/accountDeletion'

test('reauthentication completes before backend and Firebase deletion', async () => {
  const sequence: string[] = []
  const outcome = await completeAccountDeletion('secret', {
    reauthenticate: async (password) => { expect(password).toBe('secret'); sequence.push('reauth') },
    deleteData: async () => { sequence.push('backend') },
    deleteIdentity: async () => { sequence.push('firebase'); return { status: 'deleted' } },
  })
  expect(sequence).toEqual(['reauth', 'backend', 'firebase'])
  expect(outcome.status).toBe('deleted')
})

test('failed reauthentication cannot delete MapMory data', async () => {
  const sequence: string[] = []
  await expect(completeAccountDeletion('bad', {
    reauthenticate: async () => { sequence.push('reauth'); throw new Error('wrong password') },
    deleteData: async () => { sequence.push('backend') },
    deleteIdentity: async () => { sequence.push('firebase'); return { status: 'deleted' } },
  })).rejects.toThrow('wrong password')
  expect(sequence).toEqual(['reauth'])
})

test('backend failure does not delete Firebase identity', async () => {
  const sequence: string[] = []
  await expect(completeAccountDeletion('secret', {
    reauthenticate: async () => { sequence.push('reauth') },
    deleteData: async () => { sequence.push('backend'); throw new Error('backend unavailable') },
    deleteIdentity: async () => { sequence.push('firebase'); return { status: 'deleted' } },
  })).rejects.toThrow('backend unavailable')
  expect(sequence).toEqual(['reauth', 'backend'])
})

test('Firebase failure after backend commit remains an explicit partial outcome', async () => {
  const error = new Error('auth/requires-recent-login')
  const outcome = await completeAccountDeletion('secret', {
    reauthenticate: async () => {},
    deleteData: async () => {},
    deleteIdentity: async () => ({ status: 'identity-retained', error }),
  })
  expect(outcome).toEqual({ status: 'identity-retained', error })
})
