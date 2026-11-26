import { expect, test, type Page } from '@playwright/test'

/*
 * The real Firebase sign-in code (src/auth.ts) against the Firebase Auth
 * emulator: sign-up with a verification email, the verification banner, the
 * account menu, sign-out, wrong and right passwords, and account deletion with
 * re-authentication. Trips stay on the mock, so no backend is needed.
 *
 * Run:
 *   npx firebase-tools emulators:start --only auth --project demo-mapmory
 *   VITE_FIREBASE_API_KEY=demo-api-key VITE_FIREBASE_PROJECT_ID=demo-mapmory \
 *   VITE_FIREBASE_AUTH_DOMAIN=localhost VITE_FIREBASE_APP_ID=demo \
 *   VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099 npx vite --port 5180
 *   MAPMORY_TEST_FIREBASE_APP_URL=http://localhost:5180 \
 *   MAPMORY_TEST_FIREBASE_EMULATOR_URL=http://127.0.0.1:9099 npx playwright test --project=integration firebase-emulator
 */
const app = process.env.MAPMORY_TEST_FIREBASE_APP_URL?.replace(/\/$/, '')
const emulator = process.env.MAPMORY_TEST_FIREBASE_EMULATOR_URL?.replace(/\/$/, '')
const project = process.env.MAPMORY_TEST_FIREBASE_PROJECT ?? 'demo-mapmory'

test.skip(!app || !emulator, 'Set MAPMORY_TEST_FIREBASE_APP_URL and MAPMORY_TEST_FIREBASE_EMULATOR_URL to test Firebase sign-in')

interface OobCode {
  email: string
  requestType: string
  oobLink: string
}

async function verificationLink(email: string): Promise<string> {
  const response = await fetch(`${emulator}/emulator/v1/projects/${project}/oobCodes`)
  const { oobCodes } = (await response.json()) as { oobCodes: OobCode[] }
  const code = oobCodes.filter((c) => c.email === email && c.requestType === 'VERIFY_EMAIL').at(-1)
  if (!code) throw new Error(`no verification email for ${email}`)
  return code.oobLink
}

async function accountExists(email: string): Promise<boolean> {
  const response = await fetch(`${emulator}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'irrelevant', returnSecureToken: true }),
  })
  const body = (await response.json()) as { error?: { message: string } }
  return body.error?.message !== 'EMAIL_NOT_FOUND'
}

async function fillAuth(page: Page, email: string, password: string, name?: string) {
  if (name !== undefined) await page.getByLabel('Name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
}

test('sign-up, email verification, sign-out, sign-in and account deletion work with Firebase', async ({ page }) => {
  const email = `walkthrough-${Date.now()}@example.com`
  const password = 'correct-horse-9'

  // Sign up: the password rule is explained, and Firebase's own rule is enforced.
  await page.goto(`${app}/`)
  await page.getByRole('button', { name: 'Get started', exact: true }).click()
  await expect(page.getByText('Demo: sign-in is not connected yet', { exact: false })).toHaveCount(0)
  await fillAuth(page, email, '12345', 'Ana Traveller')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  // The browser's own minLength check or Firebase's rule: either way no account is made.
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toHaveCount(0)
  await fillAuth(page, email, password, 'Ana Traveller')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()

  // The account menu shows who is signed in.
  const accountButton = page.getByRole('button', { name: 'Account: Ana Traveller' })
  await accountButton.click()
  await expect(page.locator('.acct-panel').getByText(email)).toBeVisible()
  await page.keyboard.press('Escape')

  // A verification email was sent; the banner says so without blocking anything.
  const banner = page.getByRole('region', { name: 'Verify your email address' })
  await expect(banner).toContainText(email)
  await banner.getByRole('button', { name: 'I have verified it' }).click()
  await expect(banner).toContainText('Not verified yet')
  await banner.getByRole('button', { name: 'Resend email' }).click()
  await expect(banner).toContainText('A new link is on its way')

  // The emailed link returns to MapMory after verifying.
  const link = await verificationLink(email)
  expect(new URL(link).searchParams.get('continueUrl')).toBe(`${app}/dashboard`)
  const verified = await fetch(link)
  expect(verified.ok).toBe(true)
  // Coming back to the tab is enough: the banner notices without a button press,
  // says so, and then goes away.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('region', { name: 'Email address verified' })).toContainText('is confirmed')
  await expect(page.getByRole('region', { name: /Verify your email address|Email address verified/ })).toHaveCount(0, {
    timeout: 10_000,
  })

  // Sign out, then a wrong password is explained, and the right one signs in.
  await accountButton.click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await fillAuth(page, email, 'wrong-password-1')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.')
  await fillAuth(page, `  ${email}  `, password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  // Verified accounts see no banner after signing in again.
  await expect(page.getByRole('region', { name: 'Verify your email address' })).toHaveCount(0)

  // Delete the account: the password is asked again, a wrong one changes nothing.
  await accountButton.click()
  await page.getByRole('button', { name: 'Delete account…' }).click()
  const panel = page.getByRole('region', { name: 'Delete your account?' })
  await panel.getByRole('checkbox').check()
  await panel.getByLabel('Confirm your password').fill('wrong-password-1')
  await panel.getByRole('button', { name: 'Yes, delete my account' }).click()
  await expect(panel.getByRole('alert')).toContainText('Incorrect password')
  expect(await accountExists(email)).toBe(true)
  await panel.getByLabel('Confirm your password').fill(password)
  await panel.getByRole('button', { name: 'Yes, delete my account' }).click()
  await expect(page.getByRole('status')).toContainText('Your MapMory data and sign-in account were deleted.')
  expect(await accountExists(email)).toBe(false)
})
