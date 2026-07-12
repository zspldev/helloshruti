---
name: HelloShruti article content pipeline
description: How full-article fetching, AI-expanded fallback, and its caching/retry logic work — read before touching newsService.ts.
---

Content tiers for an article's `content` field, in order of preference: (1) real scraped
full text (`fullTextAvailable: true`) via Readability+jsdom against the publisher page,
(2) an LLM-generated "AI-expanded" explainer grounded in title/summary/topics when scraping
fails (`aiExpanded: true`), (3) plain RSS summary as last resort (both flags false). The UI
must label tier 2 as AI-generated, not the publisher's original reporting — it's a legal/trust
requirement, not just a nicety, since publishers don't license their text for reuse.

**Why:** many news sites bot-block scrapers (403), render content client-side (empty HTML),
or paywall — no scraper improvement fixes those. An LLM fallback still gets the user a
substantial read without leaving the app or fabricating attributed quotes/reporting.

**How to apply:**
- When adding fields to `LiveArticle`, remember `articleStore` entries are cached with a
  `storedAt` timestamp; freshness logic must be able to tell "never attempted" apart from
  "attempted recently and failed" — reusing `Date.now()` for a freshly-fetched-but-unenriched
  raw article makes it look like a recent attempt and silently skips enrichment. Use a
  sentinel (`storedAt: 0`) for not-yet-enriched entries, and never overwrite an
  already-enriched `articleStore` entry when the topic-level RSS cache refetches.
- gpt-5-family "thinking" models (e.g. gpt-5-mini) spend `max_completion_tokens` on internal
  reasoning before visible output — a low budget (e.g. 700) can silently return empty content
  for tasks that need several paragraphs. Use a generous budget (8192) for generation tasks
  with these models, not just short-answer chat.
