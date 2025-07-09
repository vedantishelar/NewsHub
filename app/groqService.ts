/* eslint-disable @typescript-eslint/no-unused-vars */
// services/groqService.ts
import { NewsArticle, TopicSummary } from './types';

export class GroqService {
  private apiKey: string;
  private baseUrl = 'https://api.groq.com/openai/v1/chat/completions';

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || '';
    if (!this.apiKey) {
      console.error('Groq API key not found in environment variables');
    }
  }

  async generateTopicSummary(
    topic: string, 
    articles: NewsArticle[]
  ): Promise<TopicSummary> {
    try {
      // Prepare the articles data for summarization
      const articlesText = articles.slice(0, 10).map(article => 
        `Title: ${article.title}\nDescription: ${article.description}\nSource: ${article.source.name}`
      ).join('\n\n');

      const prompt = `
        Analyze the following ${topic} news articles and provide:
        1. A comprehensive summary of the main trends and developments
        2. Key points (3-5 bullet points) highlighting the most important information
        3. Make it engaging and informative for general readers

        News Articles:
        ${articlesText}

        Please format your response as JSON with the following structure:
        {
          "summary": "Your comprehensive summary here",
          "keyPoints": ["Point 1", "Point 2", "Point 3", etc.]
        }
      `;

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          messages: [
            {
              role: 'system',
              content: 'You are a professional news analyst. Provide clear, concise, and informative summaries of news topics. Always respond with valid JSON format.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Parse the JSON response
      let parsedContent;
      try {
        parsedContent = JSON.parse(content);
      } catch (parseError) {
        // Fallback if JSON parsing fails
        parsedContent = {
          summary: content,
          keyPoints: ['Summary generated successfully']
        };
      }

      return {
        topic,
        summary: parsedContent.summary,
        keyPoints: parsedContent.keyPoints || [],
        totalArticles: articles.length,
        generatedAt: new Date().toISOString(),
        isLoading: false
      };

    } catch (error) {
      console.error('Error generating summary:', error);
      return {
        topic,
        summary: 'Unable to generate summary at this time. Please try again later.',
        keyPoints: ['Error occurred while generating summary'],
        totalArticles: articles.length,
        generatedAt: new Date().toISOString(),
        isLoading: false
      };
    }
  }
}