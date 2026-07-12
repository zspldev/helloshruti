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
  "Maharashtra news": "Maharashtra",
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
async function generateAiExpandedContent(article: LiveArticle): Promise<string | null> {
  const languageName = LANGUAGE_NAME[article.language];
  const languageInstruction =
    article.language === "en"
      ? ""
      : ` Write entirely in ${languageName}, using natural ${languageName} script (not transliterated English), ` +
        `as a native ${languageName}-speaking journalist would.`;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content:
            "You expand short news headlines and summaries into a longer, well-structured explainer for a reading app. " +
            "You do not have access to the original article text, so never invent specific quotes, numbers, or claims " +
            "attributed to named people that aren't in the given summary. Instead, explain relevant background, context, " +
            "and likely implications of the topic in clear, plain language. Write 4-6 short paragraphs. Do not mention " +
            `that you lack the full article or add disclaimers — just write the explainer.${languageInstruction}`,
        },
        {
          role: "user",
          content: `Headline: ${article.title}\nSummary: ${article.summary}\nTopics: ${article.topics.join(", ")}\nSource: ${article.source}`,
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
  if (fullText) {
    return {
      ...article,
      summary: firstSentences(fullText, 2) || article.summary,
      content: fullText,
      estimatedReadingTime: estimateReadingTime(fullText),
      fullTextAvailable: true,
      aiExpanded: false,
    };
  }

  const aiText = await generateAiExpandedContent(article);
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

async function getArticlesForTopic(topic: string, language: ContentLanguage): Promise<LiveArticle[]> {
  // Different languages surface entirely different articles, so the cache and
  // dedupe keys must include language or a Marathi request could return
  // (or corrupt the cache with) English results and vice versa.
  const cacheKey = `${language}:${topic}`;
  const cached = topicCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < TOPIC_CACHE_TTL_MS) {
    return cached.articles;
  }

  try {
    const articles = await fetchTopicFromBingNews(topic, language);
    topicCache.set(cacheKey, { fetchedAt: Date.now(), articles });
    for (const article of articles) {
      // Don't clobber an already-enriched entry, and don't mark a never-attempted
      // article as "just tried" — storedAt: 0 forces listRecommendations to treat
      // it as stale so enrichArticle actually runs the first time it's requested.
      if (!articleStore.has(article.id)) {
        articleStore.set(article.id, { article, storedAt: 0 });
      }
    }
    return articles;
  } catch (err) {
    logger.error({ err, topic }, "Failed to fetch live news for topic");
    // Fall back to stale cache if we have one, otherwise an empty list.
    return cached?.articles ?? [];
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
