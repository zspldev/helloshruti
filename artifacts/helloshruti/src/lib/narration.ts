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

export function getSummaryText(article: Article): string {
  return `Here is a summary of ${article.title}: ${article.summary}`;
}

export function getExplainText(article: Article, nickname = 'there'): string {
  return `Certainly, ${nickname}. This article discusses ${article.title}. In simple terms, it means that ${article.summary} It is highly relevant to your interest in ${article.topics[0] ?? 'this topic'}.`;
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
