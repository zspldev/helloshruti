---
name: HelloShruti listen-mode player
description: Unified Explain/Summary/Full-Read player architecture and how it was e2e-verified despite Clerk sign-up being unautomatable.
---

Explain/Summary/Full Read all route through one shared `shruti:listen` custom event `{ articles, articleId, mode }`, consumed by a single global `ListenPlayer` component (mounted once in App.tsx) — this replaced two divergent code paths that used to make Explain/Summary look identical and Full Read feel different. Explain/Summary text is derived by sentence-splitting the richest available article text (`content` falling back to `summary`), not hand-written templates, so length naturally scales with real content.

Transport controls (play/pause/stop/prev/next/restart/skip-to-end) are backed by `speechSynthesis.pause()/resume()` plus the MediaSession API for OS-level/lock-screen controls — there's no real audio file (TTS is synthesized live), so MediaSession is the only way to get native media-key support.

**Why:** Clerk's Cloudflare Turnstile bot check reliably blocks the Playwright-based testing subagent from completing sign-up (error 600010), even with retries/waiting — this is expected, not an app bug. When a feature requires a fresh authenticated session to reach and there's no seeded test account, full e2e through the real app isn't possible for the testing subagent.

**How to apply:** For features behind a fresh Clerk sign-up wall with no seeded test credentials, verify via an auth-free mockup-sandbox harness instead: copy the real component + its logic files verbatim (not hand-approximated) into `artifacts/mockup-sandbox/src/components/mockups/<name>/`, rewrite only the import paths, wire up mock data with buttons that dispatch the same custom events the real app uses, then point the testing subagent at the sandbox preview path. Delete the harness folder after verification — it's scaffolding, not a lasting mockup.

**Voice interaction vs. Listen Mode are distinct and independently toggleable.** `src/config/features.ts` has `FEATURES.voiceInteraction` (default off) gating the conversational assistant only: floating mic button (Dashboard), `VoiceOverlay` mount (App.tsx), and "Talk about this" (ArticleDetail) — code is kept in place, just not rendered/mounted, so it can be re-enabled by flipping one flag. Listen Mode (`ListenPlayer`, Explain/Summary/Full Read TTS playback) is unaffected by this flag — it's playback, not interaction, and stays on. Both share `voiceService.speak`/narration helpers, so don't delete those when touching either feature.
