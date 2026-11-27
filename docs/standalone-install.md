# Standalone PWA installation (#67)

MapMory ships a web app manifest, Android/Chromium icons, an Apple touch icon, and iOS standalone metadata. It intentionally does **not** register a service worker: offline access, background sync and caching are out of scope.

Verify after deploying the frontend:

1. Open `/manifest.webmanifest` and the three icon URLs directly; they should return the correct assets, not the SPA HTML fallback.
2. In Chrome/Edge on Android or desktop, use the browser's Install/Add to Home Screen flow and confirm that the app launches in its own window.
3. In Safari on a recent iPhone, use Add to Home Screen and choose **Open as Web App** when offered. Confirm that the icon and name are correct and launching does not redirect to the default browser.
4. Check sign-in persistence, internal navigation, upload and share links. If a standalone browser context requires another sign-in, document that platform behavior rather than claiming shared sessions.
5. Verify the standard website still opens normally in browsers and no offline functionality is promised.

Installation UI and behavior vary across operating systems and browser versions, so actual iOS device testing is needed before marking that acceptance criterion complete.

## Known iOS standalone issue (unresolved, 27 November 2026)

On a tested physical iPhone, the installed standalone Home Screen app allowed button and link taps, but **text fields did not receive focus and the keyboard did not appear**, blocking login and password recovery. The same fields worked in Safari. Locking/unlocking and force-closing/reopening did not resolve it. The cause (WebKit versus app-specific focus/hit testing) has not been confirmed.

**Workaround:** open MapMory directly in Safari instead of the installed Home Screen app. Do not claim iOS standalone login is verified until retested successfully. Track the defect separately from #67; standalone device-level acceptance remains pending.
