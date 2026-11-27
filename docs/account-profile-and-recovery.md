# Account profile and password recovery (#69)

Firebase Authentication remains the only source of account display names and credentials.

## Manual verification (real Firebase project)

1. Sign in with an email/password account, open the account menu and select **Edit display name**.
2. Save a name with surrounding whitespace; confirm that the trimmed name appears in the account menu and avatar. Reload the page, then sign out and in; the name must persist.
3. Try a blank name, more than 80 Unicode code points, and a network failure. The form must show an error without displaying an unsaved name as committed.
4. From the signed-out login screen, select **Forgot password?**, enter a valid test email and send the reset link. Confirm that the UI says **If an account exists...** rather than revealing registration status.
5. Follow the actual Firebase reset email, choose a new password, and sign in with it. Confirm the old password no longer signs in.
6. Request reset for a non-existing valid address, if Firebase permits it; the user-facing result must not reveal account existence. Check invalid email and rate-limit/network errors.
7. Ensure registration, email verification, private uploads and public-share permissions still work.

## Configuration

Ensure Firebase Email/Password sign-in and the project's email-action templates are configured. Test the actual email link in the deployed HTTPS origin and check Firebase authorized domains. No MapMory backend schema or service changes are required.

## Automated checks

`tests/checks/account-profile.spec.ts` validates display-name normalization. Live Firebase email delivery, profile persistence, and successful password recovery require manual integration testing.
