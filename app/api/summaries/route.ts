/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/summaries/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import SavedSummary from '@/models/SavedSummary';

// GET - Fetch all saved summaries
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const isFavorite = searchParams.get('favorite') === 'true';
    
    // Build query
    const query: any = {};
    if (topic && topic !== 'all') {
      query.topic = topic;
    }
    if (isFavorite) {
      query.isFavorite = true;
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Fetch summaries with pagination
    const summaries = await SavedSummary.find(query)
      .sort({ savedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await SavedSummary.countDocuments(query);
    
    // Ensure we always return an array, even if empty
    const resultData = Array.isArray(summaries) ? summaries : [];
    
    return NextResponse.json({
      success: true,
      data: resultData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching summaries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch summaries', data: [] }, // Include empty array in error response
      { status: 500 }
    );
  }
}

// POST - Save a new summary
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    console.log('Received save request with body:', body); // Debug log
    
    // Validate required fields
    const requiredFields = ['topic', 'summary', 'keyPoints', 'totalArticles', 'generatedAt'];
    for (const field of requiredFields) {
      if (!body[field]) {
        console.error(`Missing required field: ${field}`);
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }
    
    // Create new summary
    const savedSummary = new SavedSummary({
      topic: body.topic,
      summary: body.summary,
      keyPoints: body.keyPoints,
      totalArticles: body.totalArticles,
      generatedAt: new Date(body.generatedAt),
      savedAt: new Date(),
      title: body.title || `${body.topic.charAt(0).toUpperCase() + body.topic.slice(1)} News Summary`,
      tags: body.tags || []
    });
    
    await savedSummary.save();
    console.log('Summary saved to database:', savedSummary); // Debug log
    
    return NextResponse.json({
      success: true,
      data: savedSummary.toObject(),
      message: 'Summary saved successfully!'
    });
  } catch (error) {
    console.error('Error saving summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save summary' },
      { status: 500 }
    );
  }
}