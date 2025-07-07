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