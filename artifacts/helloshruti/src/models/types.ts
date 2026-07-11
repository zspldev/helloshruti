import { z } from "zod";

export interface UserProfile {
  name: string;
  nickname: string;
  language: string;
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
  date: string;
  relevanceIndicator: string;
  estimatedReadingTime: string;
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
