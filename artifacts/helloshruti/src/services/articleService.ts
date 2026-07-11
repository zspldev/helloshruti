import { Article, HistoryEntry } from '../models/types';

export const articleService = {
  getHistory: (): HistoryEntry[] => {
    const data = localStorage.getItem('helloshruti_history');
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  addToHistory: (article: Article) => {
    const history = articleService.getHistory();
    // Don't add duplicate if read recently
    if (history.length > 0 && history[0].articleId === article.id) return;

    const newEntry: HistoryEntry = {
      articleId: article.id,
      article,
      dateRead: new Date().toISOString()
    };

    const newHistory = [newEntry, ...history.filter(h => h.articleId !== article.id)];
    localStorage.setItem('helloshruti_history', JSON.stringify(newHistory));
  },

  saveNote: (articleId: string, note: string) => {
    const history = articleService.getHistory();
    const index = history.findIndex(h => h.articleId === articleId);
    if (index >= 0) {
      history[index].userNote = note;
      localStorage.setItem('helloshruti_history', JSON.stringify(history));
    }
  }
};
