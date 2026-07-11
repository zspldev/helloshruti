import { z } from "zod";

export interface UserProfile {
  name: string;
  nickname: string;
  language: string;
  contentLanguages: string[];
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
  imageUrl?: string | null;
  topics: string[];
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
