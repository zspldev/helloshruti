import { XMLParser } from "fast-xml-parser";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";

export type ContentLanguage = "en" | "mr" | "hi";

export interface LiveArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  url: string;
  date: string;
  estimatedReadingTime: string;
  fullTextAvailable: boolean;
  aiExpanded: boolean;
  imageUrl: string | null;
  topics: string[];
  language: ContentLanguage;
}

export interface LiveRecommendation extends LiveArticle {
  reason: string;
}

const DEFAULT_TOPICS = [
  "Taxation",
  "GST",
  "Finance",
  "Business",
  "Government policies",
];

const TOPIC_QUERY_SUFFIX: Record<string, string> = {
  Taxation: "India income tax",
  GST: "India GST",
  Finance: "India finance",
  Business: "India business",
  "Government policies": "India government policy",
  "Skill development": "India skill development",
  "Social sector": "India social sector",
  Technology: "India technology",
  // A bare "Maharashtra" query paired with mkt=mr-IN reproducibly returns zero
  // Bing News results (works fine alone or with any other market/query
  // combination) — this is what caused Marathi-language users to see no
  // content for this topic. Widening the query avoids that dead combination.
  "Maharashtra news": "Maharashtra India",
};

// Bing News RSS market codes per content language — this is what actually
// steers results toward local-language publishers, not just a UI label.
const LANGUAGE_MARKET: Record<ContentLanguage, string> = {
  en: "en-IN",
  mr: "mr-IN",
  hi: "hi-IN",
};

const LANGUAGE_NAME: Record<ContentLanguage, string> = {
  en: "English",
  mr: "Marathi",
  hi: "Hindi",
};

const TOPIC_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const ARTICLE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours, once we have real full text
const FAILED_ENRICH_RETRY_MS = 15 * 60 * 1000; // retry sooner when scraping failed, sites/CDNs vary over time

interface TopicCacheEntry {
  fetchedAt: number;
  articles: LiveArticle[];
}

const topicCache = new Map<string, TopicCacheEntry>();
const articleStore = new Map<string, { article: LiveArticle; storedAt: number }>();

const parser = new XMLParser({ ignoreAttributes: false });

function stripHtml(input: string | undefined): string {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function hashId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 31 + url.charCodeAt(i)) | 0;
  }
  return `a${Math.abs(hash)}`;
}

function estimateReadingTime(text: string): string {
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min`;
}

function firstSentences(text: string, count: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return sentences.slice(0, count).join(" ").trim();
}

const ENRICH_TIMEOUT_MS = 5000;
const BOILERPLATE_PATTERN =
  /cookie|subscribe|advertisement|sign up|newsletter|all rights reserved|terms of use|privacy policy/i;

/**
 * Best-effort fetch of the full publisher page to extract real article text.
 * News sites vary wildly in markup and many block bots or sit behind paywalls,
 * so this is allowed to fail — callers fall back to an AI-expanded read or the
 * RSS headline/summary.
 */
async function fetchFullArticleText(url: string): Promise<string | null> {
  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ENRICH_TIMEOUT_MS);
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) return null;

    html = await response.text();
  } catch (err) {
    logger.debug({ err: (err as Error).message, url }, "Full article fetch failed, using fallback instead");
    return null;
  }

  // Readability (the engine behind Firefox's reader mode) is far better than raw
  // <p> scraping at isolating the article body from nav/ads/related-links boilerplate.
  try {
    const dom = new JSDOM(html, { url });
    const parsed = new Readability(dom.window.document).parse();
    const text = parsed?.textContent?.replace(/\s+/g, " ").trim();
    if (text && text.length > 200) return text.slice(0, 4000);
  } catch (err) {
    logger.debug({ err: (err as Error).message, url }, "Readability parse failed, trying raw paragraph scrape");
  }

  // Fall back to raw paragraph scraping for pages Readability can't parse (rare).
  try {
    const $ = cheerio.load(html);
    $("script, style, nav, header, footer, aside, form").remove();

    const paragraphs = $("p")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter((text) => text.length > 40 && !BOILERPLATE_PATTERN.test(text));

    const combined = paragraphs.join(" ").trim();
    return combined.length > 200 ? combined.slice(0, 4000) : null;
  } catch {
    return null;
  }
}

/**
 * When we can't scrape real publisher text (bot-blocked, paywalled, JS-rendered),
 * ask an LLM to generate a substantially expanded explainer grounded in the
 * headline/summary/topics we already have. This is clearly labeled to users as
 * AI-generated, not the publisher's reporting — it exists so readers get more
 * than a one-line teaser without leaving the app.
 */
async function generateAiExpandedContent(article: LiveArticle, sourceText?: string): Promise<string | null> {
  const languageName = LANGUAGE_NAME[article.language];
  const languageInstruction =
    article.language === "en"
      ? ""
      : ` Write entirely in ${languageName}, using natural ${languageName} script (not transliterated English), ` +
        `as a native ${languageName}-speaking journalist would.`;

  // When we have the real scraped article text, ground the rewrite in it (faithful
  // translation/summary of real reporting) instead of inventing background from just
  // the headline — this is both more accurate and how non-English readers get access
  // to English-only source coverage (e.g. Marathi, where Bing's news index has almost
  // no native-language articles to begin with).
  const hasSource = !!sourceText;
  const task = hasSource
    ? "You are given the full text of a news article. Rewrite it as a faithful, well-structured " +
      "explainer for a reading app: preserve the real facts, quotes, and figures from the source " +
      "text, in clear plain language. Do not invent facts not present in the source."
    : "You expand short news headlines and summaries into a longer, well-structured explainer for a " +
      "reading app. You do not have access to the original article text, so never invent specific " +
      "quotes, numbers, or claims attributed to named people that aren't in the given summary. Instead, " +
      "explain relevant background, context, and likely implications of the topic in clear, plain language.";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content:
            `${task} Write 4-6 short paragraphs. Do not mention that you lack the full article or add ` +
            `disclaimers — just write the explainer.${languageInstruction}`,
        },
        {
          role: "user",
          content: hasSource
            ? `Headline: ${article.title}\nSource article text: ${sourceText}`
            : `Headline: ${article.title}\nSummary: ${article.summary}\nTopics: ${article.topics.join(", ")}\nSource: ${article.source}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    return text && text.length > 100 ? text : null;
  } catch (err) {
    logger.debug({ err: (err as Error).message, url: article.url }, "AI-expanded content generation failed");
    return null;
  }
}

async function enrichArticle(article: LiveArticle): Promise<LiveArticle> {
  const fullText = await fetchFullArticleText(article.url);

  // English articles with a real scrape can be shown verbatim. Non-English readers
  // always go through the AI rewrite step (grounded in the real scrape when we have
  // one) since the underlying source text is in English, not the reader's language.
  if (fullText && article.language === "en") {
    return {
      ...article,
      summary: firstSentences(fullText, 2) || article.summary,
      content: fullText,
      estimatedReadingTime: estimateReadingTime(fullText),
      fullTextAvailable: true,
      aiExpanded: false,
    };
  }

  const aiText = await generateAiExpandedContent(article, fullText ?? undefined);
  if (aiText) {
    return {
      ...article,
      content: aiText,
      estimatedReadingTime: estimateReadingTime(aiText),
      fullTextAvailable: false,
      aiExpanded: true,
    };
  }

  return { ...article, fullTextAvailable: false, aiExpanded: false };
}

/**
 * Bing wraps result links in an apiclick.aspx tracking redirect that embeds the
 * real publisher URL as a query param — pull it out so we link/fetch the direct page.
 */
function extractDirectUrl(bingLink: string): string {
  try {
    const parsedUrl = new URL(bingLink);
    const direct = parsedUrl.searchParams.get("url");
    return direct ? decodeURIComponent(direct) : bingLink;
  } catch {
    return bingLink;
  }
}

// Bing News' non-English indexes are extremely uneven, and a non-English `mkt`
// parameter is NOT a reliable signal on its own: querying with English keywords
// and mkt=hi-IN/mr-IN often still returns ordinary English-script articles (just
// re-labeled), while the same topic queried with native-script keywords can return
// genuine native-language results for Hindi but consistently nothing for Marathi
// (confirmed by direct testing — Bing's Marathi news index is essentially empty).
// So "native fetch succeeded" can't be judged by result count alone — we check
// that the returned titles are actually written in the target script, and only
// treat it as a free native hit if they are. Anything else (including empty, or
// English text mislabeled as hi/mr) falls back to LLM-translating the English set,
// so translation cost is only paid when native content genuinely isn't available.
const MIN_NATIVE_RESULTS = 1;
const NATIVE_SCRIPT_PATTERN: Partial<Record<ContentLanguage, RegExp>> = {
  hi: /[\u0900-\u097F]/, // Devanagari (Hindi)
  mr: /[\u0900-\u097F]/, // Devanagari (Marathi)
};

function isNativeScript(article: LiveArticle, language: ContentLanguage): boolean {
  const pattern = NATIVE_SCRIPT_PATTERN[language];
  if (!pattern) return true; // no script check defined for this language (e.g. English)
  return pattern.test(article.title);
}

async function fetchTopicFromBingNews(topic: string, language: ContentLanguage): Promise<LiveArticle[]> {
  const query = TOPIC_QUERY_SUFFIX[topic] ?? `India ${topic}`;
  const market = LANGUAGE_MARKET[language];
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&mkt=${market}&setlang=${market}`;

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; HelloShrutiBot/1.0)" },
  });

  if (!response.ok) {
    throw new Error(`Bing News RSS request failed: ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);
  const items: any[] = parsed?.rss?.channel?.item ?? [];
  const list = Array.isArray(items) ? items : [items];

  return list.slice(0, 8).map((item): LiveArticle => {
    const title: string = stripHtml(item.title);
    const summary: string = stripHtml(item.description) || title;
    const link: string = extractDirectUrl(item.link ?? url);
    const source: string = item["News:Source"] ?? "Bing News";
    const pubDate: string = item.pubDate ?? new Date().toISOString();
    const imageUrl: string | null = item["News:Image"] ?? null;

    return {
      id: hashId(link),
      title,
      summary,
      content: summary,
      source,
      url: link,
      date: new Date(pubDate).toISOString(),
      estimatedReadingTime: estimateReadingTime(summary),
      fullTextAvailable: false,
      aiExpanded: false,
      imageUrl,
      topics: [topic],
      language,
    };
  });
}

/**
 * Translate a batch of headlines/summaries into the target language in one call
 * (cheaper and more consistent than one request per article). Falls back to the
 * original English text for any article the model doesn't return a translation
 * for, so a translation hiccup degrades to English rather than dropping content.
 */
async function translateArticleList(articles: LiveArticle[], language: ContentLanguage): Promise<LiveArticle[]> {
  if (language === "en" || articles.length === 0) return articles;
  const languageName = LANGUAGE_NAME[language];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `Translate each news item's title and summary into natural, native ${languageName} ` +
            `(using ${languageName} script, not transliterated English), as a native ${languageName} ` +
            "news journalist would write it. Keep proper nouns, brand names, and numbers accurate. " +
            'Respond with JSON: { "items": [{ "id": string, "title": string, "summary": string }] }, ' +
            "one entry per input item, in the same order.",
        },
        {
          role: "user",
          content: JSON.stringify(
            articles.map((a) => ({ id: a.id, title: a.title, summary: a.summary })),
          ),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    const parsed = raw ? JSON.parse(raw) : null;
    const items: Array<{ id: string; title: string; summary: string }> = parsed?.items ?? [];
    const byId = new Map(items.map((item) => [item.id, item]));

    return articles.map((article) => {
      // Suffix the id per language: translated articles are distinct cached entries
      // (different title/summary/content, enriched independently) from the English
      // base article, but share the same underlying URL/hashId — without this,
      // fetching one language's version of a story would clobber or reuse another
      // language's cached content for the same story under one shared id.
      const localizedId = `${article.id}-${language}`;
      const translated = byId.get(article.id);
      if (!translated?.title || !translated?.summary) return { ...article, id: localizedId, language };
      return {
        ...article,
        id: localizedId,
        title: translated.title,
        summary: translated.summary,
        content: translated.summary,
        language,
      };
    });
  } catch (err) {
    logger.error({ err }, "Headline/summary translation failed, falling back to English text");
    return articles.map((article) => ({ ...article, id: `${article.id}-${language}`, language }));
  }
}

async function fetchAndCacheTopic(cacheKey: string, fetcher: () => Promise<LiveArticle[]>): Promise<LiveArticle[]> {
  const cached = topicCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < TOPIC_CACHE_TTL_MS) {
    return cached.articles;
  }

  try {
    const articles = await fetcher();
    topicCache.set(cacheKey, { fetchedAt: Date.now(), articles });
    return articles;
  } catch (err) {
    logger.error({ err, cacheKey }, "Failed to fetch live news for topic");
    // Fall back to stale cache if we have one, otherwise an empty list.
    return cached?.articles ?? [];
  }
}

// English is cached once per topic and reused as the translation source for every
// other language, so a Marathi + Hindi request in the same window doesn't refetch it twice.
async function getBaseArticlesForTopic(topic: string): Promise<LiveArticle[]> {
  return fetchAndCacheTopic(topic, () => fetchTopicFromBingNews(topic, "en"));
}

async function getArticlesForTopic(topic: string, language: ContentLanguage): Promise<LiveArticle[]> {
  if (language === "en") return getBaseArticlesForTopic(topic);

  // Try the reader's own-language Bing market first — it's a free RSS call, and it's
  // what actually serves most Hindi requests since Bing's hi-IN index has real coverage.
  // Only pay for an LLM translation of the English set when the native query comes back
  // empty/too thin (this is what actually happens for Marathi, which has near-zero
  // native coverage across topics).
  const nativeCacheKey = `${language}:${topic}:native`;
  const native = await fetchAndCacheTopic(nativeCacheKey, () => fetchTopicFromBingNews(topic, language));
  const genuineNative = native.filter((article) => isNativeScript(article, language));
  if (genuineNative.length >= MIN_NATIVE_RESULTS) {
    registerArticles(genuineNative);
    return genuineNative;
  }

  const baseArticles = await getBaseArticlesForTopic(topic);
  if (baseArticles.length === 0) return baseArticles;

  // Translated lists are cached separately per language so a Marathi request doesn't
  // re-translate on every call, but still invalidates on the same schedule as the
  // underlying English source (a stale translation cache is dropped if English refreshed).
  const cacheKey = `${language}:${topic}:translated`;
  const cached = topicCache.get(cacheKey);
  const baseFetchedAt = topicCache.get(topic)!.fetchedAt;
  if (cached && cached.fetchedAt >= baseFetchedAt && Date.now() - cached.fetchedAt < TOPIC_CACHE_TTL_MS) {
    return cached.articles;
  }

  const translated = await translateArticleList(baseArticles, language);
  topicCache.set(cacheKey, { fetchedAt: Date.now(), articles: translated });
  registerArticles(translated);
  return translated;
}

function registerArticles(articles: LiveArticle[]): void {
  for (const article of articles) {
    // Don't clobber an already-enriched entry, and don't mark a never-attempted
    // article as "just tried" — storedAt: 0 forces listRecommendations to treat
    // it as stale so enrichArticle actually runs the first time it's requested.
    if (!articleStore.has(article.id)) {
      articleStore.set(article.id, { article, storedAt: 0 });
    }
  }
}

export async function listRecommendations(
  interests: string[],
  limit: number,
  language: ContentLanguage = "en",
): Promise<LiveRecommendation[]> {
  const topics = interests.length > 0 ? interests : DEFAULT_TOPICS;

  const perTopic = await Promise.all(
    topics.map(async (topic) => ({ topic, articles: await getArticlesForTopic(topic, language) })),
  );

  const seen = new Set<string>();
  const picked: Array<{ article: LiveArticle; reason: string }> = [];

  // Round-robin across topics so the list reflects a spread of interests, not just the first topic.
  let index = 0;
  while (picked.length < limit) {
    let addedThisRound = false;
    for (const { topic, articles } of perTopic) {
      if (index >= articles.length) continue;
      const article = articles[index];
      if (!article || seen.has(article.id)) continue;
      seen.add(article.id);
      picked.push({ article, reason: `Live update on ${topic}` });
      addedThisRound = true;
      if (picked.length >= limit) break;
    }
    index += 1;
    if (!addedThisRound) break;
  }

  // Enrich only the articles we're actually returning, using cached full text when available.
  const enriched = await Promise.all(
    picked.map(async ({ article, reason }) => {
      const existing = articleStore.get(article.id);
      // Both a real scrape and a successful AI-expanded read are "good enough" results
      // worth the long cache window; only a total failure (plain RSS summary) retries soon.
      const enrichSucceeded = existing?.article.fullTextAvailable || existing?.article.aiExpanded;
      const freshnessWindow = enrichSucceeded ? ARTICLE_CACHE_TTL_MS : FAILED_ENRICH_RETRY_MS;
      const isFresh = existing && Date.now() - existing.storedAt < freshnessWindow;
      const full = isFresh ? existing.article : await enrichArticle(article);
      articleStore.set(article.id, { article: full, storedAt: Date.now() });
      return { ...full, reason };
    }),
  );

  return enriched;
}

export function getArticleById(id: string): LiveArticle | undefined {
  const entry = articleStore.get(id);
  if (!entry) return undefined;
  if (Date.now() - entry.storedAt > ARTICLE_CACHE_TTL_MS) {
    articleStore.delete(id);
    return undefined;
  }
  return entry.article;
}
