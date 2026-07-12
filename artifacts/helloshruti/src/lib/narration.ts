import { Article } from '@/models/types';

// Matches the slightly-slowed TTS rate used by voiceService (utterance.rate = 0.95),
// so the estimated durations shown in tooltips roughly track what users will hear.
const WORDS_PER_SECOND = 2.5;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function estimateSeconds(text: string): number {
  return Math.max(1, Math.round(countWords(text) / WORDS_PER_SECOND));
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `~${seconds} sec`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `~${mins}:${secs.toString().padStart(2, '0')} min`;
}

// Splits on sentence-ending punctuation, keeping the punctuation with each sentence.
function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const matches = cleaned.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g);
  return matches ? matches.map((s) => s.trim()).filter(Boolean) : [cleaned];
}

// The richest text we have for an article — real scraped text, AI-expanded
// explainer, or the RSS summary if that's all that's available. Explain and
// Summary both carve a prefix off this so they scale with how much material
// actually exists instead of always echoing the same short RSS teaser.
function richestText(article: Article): string {
  return article.content && article.content.length > article.summary.length
    ? article.content
    : article.summary;
}

// Explain: the shortest possible teaser — just enough for the user to decide
// whether they want to hear more. One sentence, no filler.
export function getExplainText(article: Article): string {
  const sentences = splitSentences(richestText(article));
  return sentences[0] ?? article.title;
}

// Summary: a fuller but still brief overview — a few sentences, distinct from
// both the one-line Explain and the full Full Read text.
export function getSummaryText(article: Article): string {
  const sentences = splitSentences(richestText(article));
  const picked = sentences.slice(0, 4);
  return picked.length > 0 ? picked.join(' ') : article.title;
}

export function getFullReadText(article: Article): string {
  if (article.aiExpanded) {
    return `${article.title}. Here's an AI-expanded explainer, since we couldn't pull the original article text. ${article.content}`;
  }
  if (!article.fullTextAvailable) {
    return `${article.title}. ${article.content} The full article isn't available to read out in full — you can open it on ${article.source} instead.`;
  }
  return `${article.title}. ${article.content}`;
}
