import { z } from "zod";

// Single source of truth for which content/narration languages the app
// supports — the same code drives article fetching (Bing News market +
// AI-expansion prompt language) and TTS narration, so they can never drift.
export type LanguageCode = 'en' | 'mr' | 'hi';

export interface UserProfile {
  name: string;
  nickname: string;
  language: LanguageCode;
  country: string;
  interests: string[];
  briefingTime: string;
  readingLength: string;
}

export interface Article {
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
  imageUrl?: string | null;
  topics: string[];
  language: LanguageCode;
  originalLanguage: LanguageCode;
}

export interface ReadingRecommendation extends Article {
  reason: string;
}

export interface HistoryEntry {
  articleId: string;
  article: Article;
  dateRead: string;
  userNote?: string;
}

export interface ConversationMessage {
  id: string;
  sender: 'shruti' | 'user';
  text: string;
  timestamp: number;
}
