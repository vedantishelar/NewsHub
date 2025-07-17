"use client"

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect } from 'react';
import { Moon, Sun, RefreshCw, Clock, ExternalLink, Search, Globe, TrendingUp, Heart, Briefcase, Zap, Gamepad2, Sparkles, Star, Brain, Lightbulb, ChevronDown, ChevronUp, BookmarkPlus, Bookmark, History, Trash2, Eye } from 'lucide-react';

// Types
interface NewsSource {
  name: string;
  url: string;
  favicon: string;
}

interface NewsArticle {
  title: string;
  url: string;
  date: string;
  thumbnail: string;
  description: string;
  source: NewsSource;
  keywords: string[];
  authors: string[];
}

interface NewsResponse {
  success: boolean;
  total: number;
  data: NewsArticle[];
}

interface TopicSummary {
  topic: string;
  summary: string;
  keyPoints: string[];
  totalArticles: number;
  generatedAt: string;
  isLoading: boolean;
}

interface SavedSummary {
  _id: string;
  topic: string;
  summary: string;
  keyPoints: string[];
  totalArticles: number;
  savedAt: string;
  title: string;
}

// Groq Service
class GroqService {
  private apiKey: string;
  private baseUrl = 'https://api.groq.com/openai/v1/chat/completions';

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY as string;
  }

  async generateTopicSummary(topic: string, articles: NewsArticle[]): Promise<TopicSummary> {
    try {
      const articlesText = articles.slice(0, 10).map(article => 
        `Title: ${article.title}\nDescription: ${article.description}\nSource: ${article.source.name}`
      ).join('\n\n');

      const prompt = `
        Analyze the following ${topic} news articles and provide a comprehensive summary and key points.
        
        News Articles:
        ${articlesText}
        
        Please provide:
        1. A comprehensive summary of the main trends and developments (2-3 paragraphs)
        2. 3-5 key points highlighting the most important information
        
        Respond ONLY with valid JSON in this exact format:
        {
          "summary": "Your comprehensive summary here",
          "keyPoints": ["Point 1", "Point 2", "Point 3"]
        }
        
        Do not include any other text, explanations, or formatting outside of this JSON structure.
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
              content: 'You are a professional news analyst. Provide clear, concise, and informative summaries of news topics. Always respond with valid JSON format only. Do not include any explanatory text outside the JSON structure.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.3,
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      let content = data.choices[0].message.content.trim();
      
      // Clean up the content - remove any markdown formatting or extra text
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Find JSON object in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }
      
      let parsedContent;
      try {
        parsedContent = JSON.parse(content);
        
        // Validate the structure
        if (!parsedContent.summary || !parsedContent.keyPoints) {
          throw new Error('Invalid JSON structure');
        }
        
        // Ensure keyPoints is an array
        if (!Array.isArray(parsedContent.keyPoints)) {
          parsedContent.keyPoints = [parsedContent.keyPoints];
        }
        
      } catch (parseError) {
        console.error('JSON parsing failed:', parseError);
        console.error('Raw content:', content);
        
        // Fallback: extract information manually
        const summaryMatch = content.match(/"summary"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
        const keyPointsMatch = content.match(/"keyPoints"\s*:\s*\[(.*?)\]/);
        
        if (summaryMatch) {
          const summary = summaryMatch[1].replace(/\\"/g, '"');
          let keyPoints = ['Summary generated successfully'];
          
          if (keyPointsMatch) {
            try {
              const keyPointsStr = keyPointsMatch[1];
              const points = keyPointsStr.match(/"([^"]*(?:\\.[^"]*)*)"/g);
              if (points) {
                keyPoints = points.map((point: string) => point.replace(/^"|"$/g, '').replace(/\\"/g, '"'));
              }
            } catch (e) {
              console.error('Error parsing key points:', e);
            }
          }
          
          parsedContent = {
            summary,
            keyPoints
          };
        } else {
          // Ultimate fallback
          parsedContent = {
            summary: 'Unable to generate summary at this time. Please try again later.',
            keyPoints: ['Error occurred while generating summary']
          };
        }
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

const NewsWebsite = () => {
  // Existing state declarations
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('health');
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  
  // New states for Groq AI summary
  const [topicSummary, setTopicSummary] = useState<TopicSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [groqService] = useState(new GroqService());

  // Modified saved summaries state - initialized as empty array
  const [savedSummaries, setSavedSummaries] = useState<SavedSummary[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const topics = [
    { id: 'health', name: 'Health', icon: Heart, color: 'from-pink-500 to-rose-500', bg: 'bg-gradient-to-r from-pink-50 to-rose-50' },
    { id: 'business', name: 'Business', icon: Briefcase, color: 'from-blue-500 to-indigo-500', bg: 'bg-gradient-to-r from-blue-50 to-indigo-50' },
    { id: 'technology', name: 'Technology', icon: Zap, color: 'from-purple-500 to-violet-500', bg: 'bg-gradient-to-r from-purple-50 to-violet-50' },
    { id: 'sports', name: 'Sports', icon: TrendingUp, color: 'from-green-500 to-emerald-500', bg: 'bg-gradient-to-r from-green-50 to-emerald-50' },
    { id: 'entertainment', name: 'Entertainment', icon: Gamepad2, color: 'from-orange-500 to-red-500', bg: 'bg-gradient-to-r from-orange-50 to-red-50' },
    { id: 'general', name: 'General', icon: Globe, color: 'from-cyan-500 to-blue-500', bg: 'bg-gradient-to-r from-cyan-50 to-blue-50' },
  ];

  const fetchNews = async (topic: string) => {
    setLoading(true);
    setError(null);
    
    const options = {
      method: 'GET',
      headers: {
        'x-rapidapi-key': '7ff1f5b26amsh2a9ae338b3130fap1f2180jsnb798c0ce4482',
        'x-rapidapi-host': 'google-news22.p.rapidapi.com'
      }
    };

    try {
      const url = `https://google-news22.p.rapidapi.com/v1/topic-headlines?country=us&language=en&topic=${topic}`;
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: NewsResponse = await response.json();
      if (data.success) {
        setArticles(data.data);
        setLastUpdated(new Date().toLocaleTimeString());
        // Reset summary when new articles are fetched
        setTopicSummary(null);
        setShowSummary(false);
      } else {
        setError('Failed to fetch news');
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      setError('Failed to fetch news. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async () => {
    if (articles.length === 0) return;
    
    setSummaryLoading(true);
    setShowSummary(true);
    
    try {
      const summary = await groqService.generateTopicSummary(selectedTopic, articles);
      setTopicSummary(summary);
    } catch (error) {
      console.error('Error generating summary:', error);
      setTopicSummary({
        topic: selectedTopic,
        summary: 'Failed to generate summary. Please try again.',
        keyPoints: ['Error occurred'],
        totalArticles: articles.length,
        generatedAt: new Date().toISOString(),
        isLoading: false
      });
    } finally {
      setSummaryLoading(false);
    }
  };

  const saveSummary = async () => {
  if (!topicSummary) return;
  
  setSavingStatus('saving');
  
  try {
    console.log('Attempting to save summary:', topicSummary); // Debug log
    
    const response = await fetch('/api/summaries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: topicSummary.topic,
        summary: topicSummary.summary,
        keyPoints: topicSummary.keyPoints,
        totalArticles: topicSummary.totalArticles,
        title: `${currentTopic?.name} News Summary - ${new Date().toLocaleDateString()}`,
        generatedAt: topicSummary.generatedAt // Make sure we include this
      }),
    });

    console.log('Save response status:', response.status); // Debug log
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Save failed:', errorData);
      throw new Error(errorData.error || 'Failed to save summary');
    }

    const data = await response.json();
    console.log('Save successful:', data); // Debug log
    
    setSavingStatus('saved');
    fetchSavedSummaries(); // Refresh the saved summaries
    setTimeout(() => setSavingStatus('idle'), 2000);
  } catch (error) {
    console.error('Error saving summary:', error);
    setSavingStatus('error');
    setTimeout(() => setSavingStatus('idle'), 2000);
  }
};

  // Modify the fetchSavedSummaries function in page.tsx
const fetchSavedSummaries = async () => {
  try {
    console.log('Fetching saved summaries...'); // Debug log
    const response = await fetch('/api/summaries');
    
    console.log('Fetch response status:', response.status); // Debug log
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Fetched summaries:', data); // Debug log
    
    // Ensure we always set an array, even if empty
    setSavedSummaries(Array.isArray(data.data) ? data.data : []);
  } catch (error) {
    console.error('Error fetching saved summaries:', error);
    setSavedSummaries([]);
  }
}; 

  const deleteSummary = async (id: string) => {
    try {
      const response = await fetch(`/api/summaries/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setSavedSummaries(savedSummaries.filter(summary => summary._id !== id));
      }
    } catch (error) {
      console.error('Error deleting summary:', error);
    }
  };

  useEffect(() => {
    fetchNews(selectedTopic);
  }, [selectedTopic]);

  useEffect(() => {
    setMounted(true);
    const savedTheme = false;
    setDarkMode(savedTheme);
  }, []);

  useEffect(() => {
    fetchSavedSummaries();
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTopicChange = (topic: string) => {
    setSelectedTopic(topic);
    setSearchTerm('');
    setTopicSummary(null);
    setShowSummary(false);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.src = 'https://via.placeholder.com/400x200?text=No+Image';
  };

  const currentTopic = topics.find(t => t.id === selectedTopic);

  return (
    <div className={`min-h-screen transition-all duration-500 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white' 
        : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 text-gray-900'
    }`}>
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full ${
          darkMode ? 'bg-purple-600/20' : 'bg-blue-400/20'
        } blur-3xl animate-pulse`}></div>
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full ${
          darkMode ? 'bg-blue-600/20' : 'bg-purple-400/20'
        } blur-3xl animate-pulse`}></div>
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-xl border-b ${
        darkMode 
          ? 'bg-gray-900/80 border-gray-700/50' 
          : 'bg-white/80 border-white/50'
      } shadow-lg`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-75"></div>
                  <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-xl">
                    <Sparkles className="h-8 w-8 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                    NewsHub
                  </h1>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Stay Updated, Stay Informed
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative hidden sm:block">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur opacity-25"></div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search news..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`pl-12 pr-6 py-3 w-64 rounded-full border-2 transition-all duration-300 ${
                      darkMode 
                        ? 'bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 focus:border-purple-500' 
                        : 'bg-white/70 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                    } focus:outline-none focus:ring-4 focus:ring-blue-500/20`}
                  />
                </div>
              </div>
              
              <button
                onClick={() => fetchNews(selectedTopic)}
                disabled={loading}
                className={`relative p-3 rounded-full transition-all duration-300 ${
                  darkMode 
                    ? 'bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600' 
                    : 'bg-white/70 hover:bg-white/90 border border-gray-200'
                } hover:scale-110 ${loading ? 'animate-spin' : ''} shadow-lg`}
              >
                <RefreshCw className="h-5 w-5" />
              </button>
              
              <button
                onClick={toggleDarkMode}
                className={`relative p-3 rounded-full transition-all duration-300 ${
                  darkMode 
                    ? 'bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600' 
                    : 'bg-white/70 hover:bg-white/90 border border-gray-200'
                } hover:scale-110 shadow-lg`}
              >
                {darkMode ? <Sun className="h-5 w-5 text-yellow-500" /> : <Moon className="h-5 w-5 text-purple-600" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Search */}
      <div className={`sm:hidden px-4 py-4 ${darkMode ? 'bg-gray-800/50' : 'bg-white/50'} backdrop-blur-sm`}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search news..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`pl-12 pr-6 py-3 w-full rounded-full border-2 transition-all duration-300 ${
              darkMode 
                ? 'bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 focus:border-purple-500' 
                : 'bg-white/70 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500'
            } focus:outline-none focus:ring-4 focus:ring-blue-500/20`}
          />
        </div>
      </div>

      {/* Topic Navigation */}
      <nav className={`${darkMode ? 'bg-gray-800/30' : 'bg-white/30'} backdrop-blur-sm border-b ${
        darkMode ? 'border-gray-700/50' : 'border-white/50'
      } sticky top-20 z-40`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-2 sm:space-x-4 overflow-x-auto py-6 scrollbar-hide">
            {topics.map(topic => {
              const Icon = topic.icon;
              const isActive = selectedTopic === topic.id;
              return (
                <button
                  key={topic.id}
                  onClick={() => handleTopicChange(topic.id)}
                  className={`flex items-center space-x-2 px-4 sm:px-6 py-3 rounded-2xl whitespace-nowrap transition-all duration-300 transform hover:scale-105 ${
                    isActive
                      ? `bg-gradient-to-r ${topic.color} text-white shadow-lg shadow-${topic.color.split('-')[1]}-500/30`
                      : darkMode
                      ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:text-white'
                      : 'bg-white/50 text-gray-600 hover:bg-white/80 hover:text-gray-900'
                  } border border-white/20`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-semibold text-sm sm:text-base">{topic.name}</span>
                  {isActive && <Star className="h-4 w-4 animate-pulse" />}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Stats Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                {currentTopic && (
                  <div className={`p-2 rounded-xl bg-gradient-to-r ${currentTopic.color}`}>
                    <currentTopic.icon className="h-6 w-6 text-white" />
                  </div>
                )}
                <h2 className={`text-3xl sm:text-4xl font-bold bg-gradient-to-r ${currentTopic?.color} bg-clip-text text-transparent`}>
                  {currentTopic?.name} News
                </h2>
              </div>
              <div className="flex items-center space-x-4">
                <p className={`${darkMode ? 'text-purple-300' : 'text-purple-600'} font-medium`}>
                  {filteredArticles.length} articles found
                </p>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  darkMode ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-700'
                }`}>
                  Live Updates
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} flex items-center space-x-2`}>
                <Clock className="h-4 w-4" />
                <span>{mounted && lastUpdated && `Last updated: ${lastUpdated}`}</span>
              </div>
              
              {/* AI Summary Button */}
              {articles.length > 0 && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={generateSummary}
                    disabled={summaryLoading}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-300 transform hover:scale-105 ${
                      darkMode 
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700' 
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                    } text-white shadow-lg`}
                  >
                    <Brain className={`h-5 w-5 ${summaryLoading ? 'animate-pulse' : ''}`} />
                    <span className="font-medium">
                      {summaryLoading ? 'Generating...' : 'AI Summary'}
                    </span>
                  </button>
                  
                  <button
                    onClick={() => setShowSaved(!showSaved)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-300 transform hover:scale-105 ${
                      darkMode 
                        ? 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700' 
                        : 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700'
                    } text-white shadow-lg`}
                  >
                    <History className="h-5 w-5" />
                    <span className="font-medium">
                      Saved ({savedSummaries.length})
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Summary Section */}
        {showSummary && (
          <div className={`mb-8 rounded-3xl overflow-hidden transition-all duration-500 ${
            darkMode 
              ? 'bg-gray-800/50 border border-gray-700/50' 
              : 'bg-white/70 border border-white/50'
          } backdrop-blur-sm shadow-lg`}>
            <div className={`px-6 py-4 border-b ${
              darkMode ? 'border-gray-700/50 bg-gradient-to-r from-purple-900/30 to-pink-900/30' : 'border-white/50 bg-gradient-to-r from-blue-50/50 to-purple-50/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600">
                    <Brain className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      AI-Generated Summary
                    </h3>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {currentTopic?.name} News Overview
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSummary(!showSummary)}
                  className={`p-2 rounded-full transition-all duration-300 ${
                    darkMode 
                      ? 'bg-gray-700/50 hover:bg-gray-600/50' 
                      : 'bg-white/50 hover:bg-white/80'
                  }`}
                >
                  {showSummary ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {summaryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600"></div>
                    <Brain className="absolute inset-0 m-auto h-6 w-6 text-blue-600 animate-pulse" />
                  </div>
                </div>
              ) : topicSummary ? (
                <div className="space-y-6">
                  <div>
                    <h4 className={`text-lg font-semibold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Summary
                    </h4>
                    <p className={`text-base leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {topicSummary.summary}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className={`text-lg font-semibold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Key Points
                    </h4>
                    <ul className="space-y-2">
                      {topicSummary.keyPoints.map((point, index) => (
                        <li key={index} className={`flex items-start space-x-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <span className="text-base">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {topicSummary && !summaryLoading && (
                    <div className="flex justify-end">
                      <button
                        onClick={saveSummary}
                        disabled={savingStatus === 'saving'}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-300 transform hover:scale-105 ${
                          savingStatus === 'saved' 
                            ? 'bg-gradient-to-r from-green-600 to-green-600' 
                            : savingStatus === 'error'
                            ? 'bg-gradient-to-r from-red-600 to-red-600'
                            : darkMode 
                            ? 'bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700' 
                            : 'bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700'
                        } text-white shadow-lg`}
                      >
                        {savingStatus === 'saving' ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span className="font-medium">Saving...</span>
                          </>
                        ) : savingStatus === 'saved' ? (
                          <>
                            <Bookmark className="h-5 w-5" />
                            <span className="font-medium">Saved!</span>
                          </>
                        ) : savingStatus === 'error' ? (
                          <>
                            <span className="font-medium">Error</span>
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="h-5 w-5" />
                            <span className="font-medium">Save Summary</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  
                  <div className={`pt-4 border-t ${darkMode ? 'border-gray-700/50' : 'border-gray-200/50'}`}>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Generated from {topicSummary.totalArticles} articles • {new Date(topicSummary.generatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Click &quot;AI Summary&quot; to generate an intelligent overview of the current news.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Saved Summaries Section */}
        {showSaved && (
          <div className={`mb-8 rounded-3xl overflow-hidden transition-all duration-500 ${
            darkMode 
              ? 'bg-gray-800/50 border border-gray-700/50' 
              : 'bg-white/70 border border-white/50'
          } backdrop-blur-sm shadow-lg`}>
            <div className={`px-6 py-4 border-b ${
              darkMode ? 'border-gray-700/50 bg-gradient-to-r from-green-900/30 to-teal-900/30' : 'border-white/50 bg-gradient-to-r from-green-50/50 to-teal-50/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-green-600 to-teal-600">
                    <History className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Saved Summaries
                    </h3>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {savedSummaries.length} summaries saved
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSaved(false)}
                  className={`p-2 rounded-full transition-all duration-300 ${
                    darkMode 
                      ? 'bg-gray-700/50 hover:bg-gray-600/50' 
                      : 'bg-white/50 hover:bg-white/80'
                  }`}
                >
                  <ChevronUp className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {savedSummaries.length === 0 ? (
                <div className="text-center py-8">
                  <Bookmark className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    No saved summaries yet. Generate and save some summaries to see them here!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedSummaries.map((summary) => (
                    <div
                      key={summary._id}
                      className={`p-4 rounded-xl border transition-all duration-300 ${
                        darkMode 
                          ? 'bg-gray-700/30 border-gray-600/50 hover:bg-gray-700/50' 
                          : 'bg-white/50 border-gray-200/50 hover:bg-white/80'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            {summary.title}
                          </h4>
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {summary.topic} • {new Date(summary.savedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteSummary(summary._id)}
                          className={`p-1 rounded-full transition-all duration-300 ${
                            darkMode 
                              ? 'text-red-400 hover:bg-red-900/30' 
                              : 'text-red-600 hover:bg-red-100'
                          }`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <p className={`text-sm mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {summary.summary.substring(0, 200)}...
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            darkMode 
                              ? 'bg-gray-600/50 text-gray-300' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {summary.keyPoints.length} key points
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            darkMode 
                              ? 'bg-gray-600/50 text-gray-300' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {summary.totalArticles} articles
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setTopicSummary({
                              topic: summary.topic,
                              summary: summary.summary,
                              keyPoints: summary.keyPoints,
                              totalArticles: summary.totalArticles,
                              generatedAt: summary.savedAt,
                              isLoading: false
                            });
                            setShowSummary(true);
                            setShowSaved(false);
                          }}
                          className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm transition-all duration-300 ${
                            darkMode 
                              ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30' 
                              : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                          }`}
                        >
                          <Eye className="h-4 w-4" />
                          <span>View</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-8 p-6 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 text-red-700 rounded-2xl shadow-lg">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-purple-200 rounded-full animate-spin border-t-purple-600 animate-reverse"></div>
            </div>
          </div>
        )}

        {/* Articles Grid */}
        {!loading && filteredArticles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredArticles.map((article, index) => (
              <article
                key={index}
                className={`group relative rounded-3xl overflow-hidden transition-all duration-500 transform hover:scale-105 hover:-translate-y-2 ${
                  darkMode 
                    ? 'bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/50' 
                    : 'bg-white/70 border border-white/50 hover:bg-white/90'
                } backdrop-blur-sm shadow-lg hover:shadow-2xl`}
              >
                {/* Article Image */}
                <div className="relative overflow-hidden">
                  <img
                    src={article.thumbnail}
                    alt={article.title}
                    className="w-full h-48 sm:h-56 object-cover transition-transform duration-700 group-hover:scale-110"
                    onError={handleImageError}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  <div className="absolute top-4 right-4">
                    <div className={`px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                      darkMode ? 'bg-gray-900/80 text-white' : 'bg-white/90 text-gray-900'
                    } shadow-lg`}>
                      {article.source.name}
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 flex items-center space-x-2 text-white">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-medium">{formatDate(article.date)}</span>
                  </div>
                </div>
                
                {/* Article Content */}
                <div className="p-6">
                  <h3 className={`font-bold text-lg sm:text-xl mb-3 line-clamp-2 ${
                    darkMode ? 'text-white' : 'text-black'
                  } group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 group-hover:bg-clip-text transition-all duration-300`}>
                    {article.title}
                  </h3>
                  
                  <p className={`text-sm mb-4 line-clamp-3 ${
                    darkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {article.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full hover:from-blue-600 hover:to-purple-600 transition-all duration-300 transform hover:scale-105 text-sm font-medium"
                    >
                      <span>Read More</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  
                  {/* Keywords */}
                  {article.keywords.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                      <div className="flex flex-wrap gap-2">
                        {article.keywords.slice(0, 3).map((keyword, idx) => (
                          <span
                            key={idx}
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              darkMode 
                                ? 'bg-gray-700/50 text-gray-300 border border-gray-600/50' 
                                : 'bg-gray-100/50 text-gray-600 border border-gray-200/50'
                            } hover:scale-105 transition-transform duration-200`}
                          >
                            #{keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {/* No Results */}
        {!loading && filteredArticles.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-2xl opacity-20"></div>
              </div>
              <Globe className="relative h-20 w-20 text-gray-400 mx-auto" />
            </div>
            <h3 className={`text-2xl font-bold mb-4 bg-gradient-to-r ${currentTopic?.color} bg-clip-text text-transparent`}>
              No articles found
            </h3>
            <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'} max-w-md mx-auto`}>
              Try adjusting your search terms or selecting a different topic to discover more stories.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={`relative mt-20 border-t ${
        darkMode ? 'border-gray-700/50 bg-gray-800/30' : 'border-white/50 bg-white/30'
      } backdrop-blur-sm`}>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-75"></div>
                <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-xl">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                NewsHub
              </span>
            </div>
            <p className={`text-base mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Stay informed with the latest news from around the world.
            </p>
            <div className="flex justify-center space-x-6 mb-6">
              {['Privacy', 'Terms', 'Contact', 'About'].map((item) => (
                <button
                  key={item}
                  className={`text-sm ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors duration-200`}
                >
                  {item}
                </button>
              ))}
            </div>
            <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              © 2025 NewsHub. All rights reserved. Designed with ❤️ for news lovers.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default NewsWebsite;