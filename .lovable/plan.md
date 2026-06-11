## What's actually happening

The "incorrect UI" screenshots are not coming from the current code. I searched the entire `src/` tree for the strings shown on those screens — `"WMS Lite"`, `"Sign in to access warehouse management"`, `"Don't have an account? Sign up"`, `"Sign in with Apple"`, `"INTERNAL OPERATIONS"`, `"Live activity across receiving, storage, and outbound work"` — and **none of them exist anywhere in the project**.

The current source renders the "Welcome back / User code / Enterprise Warehouse Management System" login and the Command Center dashboard you see in your "correct" screenshots.

The difference between the two screenshots is the URL:

- Stale (editor iframe): `id-preview--b1278655-...lovable.app`
- Fresh (new tab): `preview--threeplmgmt.lovable.app`

These are two separate origins. The iframe origin has an old service worker + Cache Storage entry that was registered by a much earlier build of the app, and it's serving that old HTML/JS shell to the iframe before the network request for the new build ever runs.

`src/main.tsx` already tries to unregister the SW inside iframes, but the cleanup is fire-and-forget and gated by a `sessionStorage` flag that only allows one reload per session. So on the very first visit the old cached shell paints, the SW gets queued for removal, and the auto-reload either doesn't fire or fires once and then the flag prevents future cleanups when a new old shell variant shows up.

## Fix

Harden the iframe/preview cleanup in `src/main.tsx` so it deterministically removes the stale shell:

1. Run SW unregister and `caches.delete(...)` for every cache as awaited promises (wrapped in an async IIFE), not fire-and-forget.
2. After both finish, if anything was actually removed, force `window.location.reload()` — but key the "already reloaded" guard on the current `__APP_VERSION__` (e.g. `__lovable_sw_reloaded_v_<version>`) instead of a plain flag, so a new build can trigger another cleanup reload.
3. Add a `<meta http-equiv="Clear-Site-Data" content="cache, storage">`-style belt-and-braces by also calling `navigator.serviceWorker.controller?.postMessage({ type: "SKIP_WAITING" })` before unregister, so any controlling SW releases the page first.
4. Keep the existing HTTP cache-busting `?v=` query.

No UI changes, no feature changes — this only touches `src/main.tsx`.

## After the code change

Even with the fix in place, the *currently* cached iframe needs one manual eviction so the new `main.tsx` can run at all. I'll give you a one-time recovery step (hard-refresh the iframe with DevTools open → Application → Service Workers → Unregister, or just open the preview in a new tab once). After that, the hardened cleanup keeps it from coming back.

## Files touched

- `src/main.tsx` — harden iframe/preview SW + Cache Storage cleanup and version-key the reload guard.

Nothing else in the app changes.
