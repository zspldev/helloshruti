---
name: HelloShruti TTS provider architecture
description: Provider-agnostic TTS adapter pattern and multi-language (en/mr/hi) content pipeline for HelloShruti.
---

## Provider-agnostic TTS

TTS is implemented as a swappable adapter behind `artifacts/api-server/src/config/ttsProvider.json`
(active `provider` name + per-provider settings) and `artifacts/api-server/src/lib/tts/`
(`types.ts` interface, one file per adapter, `index.ts` dispatcher). Switching vendors is a JSON
edit, not a code change — add a new adapter file + register it in the dispatcher's factory map.

**Why:** explicit user requirement so a future provider swap (cost, quality, outage) doesn't
require touching call sites.

**How to apply:** the actual provider call always happens server-side (never expose the API key to
the browser). The frontend (`voiceService.speak`) calls the backend's `/api/tts` route and falls
back to the browser's `speechSynthesis` on any failure, so narration never silently breaks.

Sarvam (Bulbul v3) caps text at 2500 chars/request and returns WAV as base64. Longer text (e.g. Full
Read) must be chunked on sentence boundaries and the resulting WAVs concatenated by rewriting the
RIFF/data chunk sizes in the first header and appending raw PCM data from the rest — see
`artifacts/api-server/src/lib/tts/wav.ts`. This only works because all chunks share one format
(same provider call, same sample rate).

## Multi-language content (en/mr/hi)

`ContentLanguage` (`en`/`mr`/`hi`) is a first-class dimension end-to-end: `Article.language` in the
OpenAPI spec, a `language` query param on `GET /articles`, and `UserProfile.language` on the
frontend (single choice — it now drives both content fetching and narration, replacing an earlier
separate "content languages" multi-select that was UI-only and never wired to anything real).

Bing News RSS results differ per language via the `mkt`/`setlang` query params (e.g. `mr-IN`,
`hi-IN`) — the topic cache must be keyed by `${language}:${topic}`, not topic alone, or a Marathi
request can serve or poison the English cache entry.

## Plaintext secret discovered

`SARVAM_API_KEY` was found stored as a plain shared environment variable (visible value) rather than
a proper Replit secret. Do not silently "fix" this — offer the user a re-entry via the secure
secrets form, since a value already seen via env-var inspection cannot be safely moved into secret
storage programmatically.
