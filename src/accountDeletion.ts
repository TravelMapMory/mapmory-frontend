import type { IdentityDeletionResult } from './auth'

/** Reauthentication must succeed BEFORE any backend data is removed. */
export async function completeAccountDeletion(
  password: string,
  steps: {
    reauthenticate: (password: string) => Promise<void>
    deleteData: () => Promise<void>
    deleteIdentity: () => Promise<IdentityDeletionResult>
  },
): Promise<IdentityDeletionResult> {
  await steps.reauthenticate(password)
  await steps.deleteData()
  return steps.deleteIdentity()
}
