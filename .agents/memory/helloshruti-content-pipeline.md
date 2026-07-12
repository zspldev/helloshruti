---
name: HelloShruti article content pipeline
description: How full-article fetching, AI-expanded fallback, multi-language translation, and its caching/retry logic work — read before touching newsService.ts.
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

## Non-English content: translate, don't rely on Bing's per-language index

Bing News' RSS index coverage varies wildly by language and isn't just an `mkt`/`setlang`
ranking knob — querying with `mkt=mr-IN` (Marathi) returns real Devanagari results for some
narrow topics (e.g. "Maharashtra") but **zero results for almost every other query**, in
either English or Devanagari script. Meanwhile English-keyword queries with a non-English
`mkt` don't error or come back empty — they silently return ordinary English-language
articles tagged as if they were in that market. The net effect: a naive per-language Bing
query looks like it's working (200 OK, articles returned) but silently serves English content
to non-English users. Hindi (`hi-IN`) happens to have decent native coverage; Marathi does not.

**Why:** this is a real Bing index gap, not a query-construction bug — confirmed by testing
the same topics with English and native-script queries across every default topic.

**How to apply:** the content pipeline always sources articles in English from Bing (one
shared per-topic cache), then machine-translates title/summary (batched, one LLM call per
topic) and full content into the reader's language when it isn't English. Full-article
enrichment for non-English readers always goes through the AI-expansion step — grounded in
the real scraped English text when available, for a faithful translation/summary rather than
a heading-only guess — never returned as verbatim scraped text. Translated articles get an
`id` suffixed with the language code (e.g. `<hash>-mr`) since the underlying English article
shares one Bing-derived hash; without the suffix, translations for different languages would
collide/clobber each other's cached entries under the same id. Do not add a new supported
language without first confirming Bing actually has index coverage for it, or route it through
this same translate-from-English path by default.
