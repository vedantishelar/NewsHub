// services/databaseService.ts
import { TopicSummary } from '@/app/types';
import { ISavedSummary } from '@/models/SavedSummary';

export class DatabaseService {
  private baseUrl: string;


  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  }

  async saveSummary(
    summaryData: TopicSummary,
    title?: string,
    tags?: string[]
  ): Promise<ISavedSummary> {
    try {
      const response = await fetch(`${this.baseUrl}/api/summaries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: summaryData.topic,
          summary: summaryData.summary,
          keyPoints: summaryData.keyPoints,
          totalArticles: summaryData.totalArticles,
          generatedAt: summaryData.generatedAt,
          title: title || `${summaryData.topic.charAt(0).toUpperCase() + summaryData.topic.slice(1)} News Summary`,
          tags: tags || []
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to save summary');
      }

      return data.data;
    } catch (error) {
      console.error('Error saving summary:', error);
      throw error;
    }
  }

  async getSavedSummaries(
    topic?: string,
    page = 1,
    limit = 10,
    favorite = false
  ): Promise<{
    summaries: ISavedSummary[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        favorite: favorite.toString()
      });

      if (topic && topic !== 'all') {
        params.append('topic', topic);
      }

      const response = await fetch(`${this.baseUrl}/api/summaries?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch summaries');
      }

      return {
        summaries: data.data,
        pagination: data.pagination
      };
    } catch (error) {
      console.error('Error fetching summaries:', error);
      throw error;
    }
  }

  async getSummaryById(id: string): Promise<ISavedSummary> {
    try {
      const response = await fetch(`${this.baseUrl}/api/summaries/${id}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch summary');
      }

      return data.data;
    } catch (error) {
      console.error('Error fetching summary:', error);
      throw error;
    }
  }

  async updateSummary(
    id: string,
    updates: {
      title?: string;
      tags?: string[];
      isFavorite?: boolean;
    }
  ): Promise<ISavedSummary> {
    try {
      const response = await fetch(`${this.baseUrl}/api/summaries/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update summary');
      }

      return data.data;
    } catch (error) {
      console.error('Error updating summary:', error);
      throw error;
    }
  }

  async deleteSummary(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/summaries/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete summary');
      }
    } catch (error) {
      console.error('Error deleting summary:', error);
      throw error;
    }
  }
}