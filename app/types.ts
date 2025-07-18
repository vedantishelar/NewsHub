// types.ts
export interface NewsSource {
  name: string;
  url: string;
  favicon: string;
}

export interface NewsArticle {
  title: string;
  url: string;
  date: string;
  thumbnail: string;
  description: string;
  source: NewsSource;
  keywords: string[];
  authors: string[];
}

export interface NewsResponse {
  success: boolean;
  total: number;
  data: NewsArticle[];
}

export interface NewsApiOptions {
  method: string;
  url: string;
  params: {
    country: string;
    language: string;
    topic: string;
  };
  headers: {
    'x-rapidapi-key': string;
    'x-rapidapi-host': string;
  };
}

// New interfaces for Groq AI summary
export interface TopicSummary {
  topic: string;
  summary: string;
  keyPoints: string[];
  totalArticles: number;
  generatedAt: string;
  isLoading: boolean;
}

export interface GroqResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Database interfaces
export interface SavedSummary {
  _id: string;
  topic: string;
  summary: string;
  keyPoints: string[];
  totalArticles: number;
  generatedAt: string;
  savedAt: string;
  title?: string;
  tags?: string[];
  isFavorite?: boolean;
}

export interface SaveSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, tags: string[]) => void;
  isLoading: boolean;
}

export interface SavedSummariesModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  currentTopic: string;
}