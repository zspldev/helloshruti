import { Article, ReadingRecommendation, UserProfile } from '../models/types';
import { articleService } from './articleService';

export const aiRecommendationService = {
  getRecommendationsForUser: (): ReadingRecommendation[] => {
    const profileStr = localStorage.getItem('helloshruti_profile');
    if (!profileStr) return [];
    
    try {
      const profile: UserProfile = JSON.parse(profileStr);
      const allArticles = articleService.getArticles();
      
      // Simple mock: filter by interests if any match, otherwise return all
      let relevant = allArticles.filter(article => 
        article.topics.some(t => profile.interests.includes(t))
      );
      
      if (relevant.length === 0) {
        relevant = allArticles;
      }
      
      return relevant.slice(0, 5).map(article => ({
        ...article,
        reason: `Based on your interest in ${article.topics.find(t => profile.interests.includes(t)) || article.topics[0]}`
      }));
    } catch (e) {
      return [];
    }
  }
};