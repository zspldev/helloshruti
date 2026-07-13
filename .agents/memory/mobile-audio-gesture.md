---
name: Mobile audio gesture requirement
description: Why fetched TTS/audio playback silently failed or hung on mobile web/PWA, and the fix pattern.
---

Mobile browsers (most strictly iOS Safari, including installed PWAs) only allow
an `<audio>`/`<video>` element to start playback without a *fresh* user
gesture if that specific element already had a successful `.play()` call
started directly inside a gesture handler (click/tap). If real audio only
exists after an async step (e.g. an uncached backend TTS fetch that takes
several seconds), calling `new Audio(src).play()` for the first time inside
that fetch's `.then()` happens outside the gesture window — symptoms range
from "plays" with no audible sound, to `play()` rejecting and the calling
code getting stuck in a permanent loading/buffering state if there's no
timeout fallback.

**Why:** this caused three symptoms in HelloShruti that looked unrelated at
first — "first clip plays but no voice", "Explain stuck on Loading forever" —
before tracing both to the same root cause. The backend TTS pipeline itself
(WAV generation, multi-chunk concatenation) was verified correct in both
cases; the bug was purely in when playback was triggered relative to the
gesture.

**How to apply:** when audio/video playback depends on an async fetch, create
and `.play()` the real (or a silent placeholder) media element synchronously
inside the gesture handler first, then swap its `src` once the async data
arrives and call `.play()` again — the element stays "activated" across the
async gap. Always pair this with a hard timeout that forces a fallback path
(e.g. browser `speechSynthesis`) so a hung fetch or a browser that never
fires start/error events can't leave the UI stuck in a loading state forever.
