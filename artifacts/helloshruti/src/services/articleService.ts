import { Article, HistoryEntry } from '../models/types';

const MOCK_ARTICLES: Article[] = [
  {
    id: "a1",
    title: "New GST Regulations for Digital Services",
    summary: "The GST Council has introduced a new framework for digital services, establishing a uniform 18% rate across all inter-state digital transactions. This aims to simplify compliance for service providers.",
    content: "The GST Council has introduced a new framework for digital services, establishing a uniform 18% rate across all inter-state digital transactions. This aims to simplify compliance for service providers. Previously, there was ambiguity regarding the classification of certain software-as-a-service offerings. The new circular clarifies that any cloud-based service will be treated as an inter-state supply, requiring mandatory registration regardless of the turnover threshold. Businesses have 90 days to align their billing systems.",
    source: "Taxation Weekly",
    date: new Date().toISOString(),
    relevanceIndicator: "High relevance to Taxation",
    estimatedReadingTime: "4 min",
    topics: ["Taxation", "GST", "Business"]
  },
  {
    id: "a2",
    title: "Maharashtra IT Policy Update 2024",
    summary: "The state government has announced significant subsidies for IT companies setting up operations in Tier-2 cities like Nashik and Nagpur.",
    content: "The state government has announced significant subsidies for IT companies setting up operations in Tier-2 cities like Nashik and Nagpur. The policy includes a 100% stamp duty exemption and electricity duty waiver for the first five years. The goal is to decongest Pune and Mumbai while generating local employment. A special task force has been created to ensure single-window clearance for all requisite permits within 30 days of application.",
    source: "Gov Track",
    date: new Date(Date.now() - 86400000).toISOString(),
    relevanceIndicator: "Matches Maharashtra news",
    estimatedReadingTime: "3 min",
    topics: ["Maharashtra news", "Government policies", "Technology"]
  },
  {
    id: "a3",
    title: "RBI's New Guidelines on MSME Lending",
    summary: "The Reserve Bank of India has mandated banks to process MSME loan applications under ₹50 lakhs within 15 days.",
    content: "The Reserve Bank of India has mandated banks to process MSME loan applications under ₹50 lakhs within 15 days. If a bank fails to do so, they must provide a written explanation to the nodal officer. The move is expected to alleviate the working capital crunch faced by small businesses. Furthermore, banks are encouraged to utilize alternative data sources like GST returns for credit appraisal instead of relying solely on traditional collateral.",
    source: "Financial Times India",
    date: new Date(Date.now() - 172800000).toISOString(),
    relevanceIndicator: "Relevant to Finance",
    estimatedReadingTime: "5 min",
    topics: ["Finance", "Business"]
  },
  {
    id: "a4",
    title: "National Skill Development Program Overhaul",
    summary: "The Ministry has revamped the skill certification process, partnering with industry leaders to ensure curriculum relevance.",
    content: "The Ministry has revamped the skill certification process, partnering with industry leaders to ensure curriculum relevance. Over 50 outdated courses have been phased out, replaced with programs focusing on AI, data analytics, and advanced manufacturing. The new framework also introduces apprenticeships as a mandatory component for certification, bridging the gap between theoretical knowledge and practical application.",
    source: "Policy Watch",
    date: new Date(Date.now() - 259200000).toISOString(),
    relevanceIndicator: "Key update on Skill development",
    estimatedReadingTime: "3 min",
    topics: ["Skill development", "Social sector"]
  },
  {
    id: "a5",
    title: "Impact of AI on Chartered Accountancy",
    summary: "A deep dive into how artificial intelligence is automating routine auditing tasks, shifting the accountant's role towards strategic advisory.",
    content: "A deep dive into how artificial intelligence is automating routine auditing tasks, shifting the accountant's role towards strategic advisory. Routine data entry, reconciliation, and anomaly detection are increasingly handled by software. This allows CAs to focus on complex tax planning, business restructuring, and financial forecasting. The article emphasizes the need for continuous learning, particularly in data security and tech compliance.",
    source: "CA Professional",
    date: new Date(Date.now() - 345600000).toISOString(),
    relevanceIndicator: "Matches Technology",
    estimatedReadingTime: "6 min",
    topics: ["Technology", "Finance"]
  }
];

export const articleService = {
  getArticles: (): Article[] => {
    return MOCK_ARTICLES;
  },
  
  getArticleById: (id: string): Article | undefined => {
    return MOCK_ARTICLES.find(a => a.id === id);
  },

  getHistory: (): HistoryEntry[] => {
    const data = localStorage.getItem('helloshruti_history');
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  addToHistory: (articleId: string) => {
    const article = MOCK_ARTICLES.find(a => a.id === articleId);
    if (!article) return;
    
    const history = articleService.getHistory();
    // Don't add duplicate if read recently
    if (history.length > 0 && history[0].articleId === articleId) return;
    
    const newEntry: HistoryEntry = {
      articleId,
      article,
      dateRead: new Date().toISOString()
    };
    
    const newHistory = [newEntry, ...history.filter(h => h.articleId !== articleId)];
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