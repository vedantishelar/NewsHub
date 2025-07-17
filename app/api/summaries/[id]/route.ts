/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/summaries/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import SavedSummary from '@/models/SavedSummary';

// GET - Get specific summary by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    const summary = await SavedSummary.findById(params.id).lean();
    
    if (!summary) {
      return NextResponse.json(
        { success: false, error: 'Summary not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch summary' },
      { status: 500 }
    );
  }
}

// PUT - Update summary
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { title, tags, isFavorite } = body;
    
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (tags !== undefined) updateData.tags = tags;
    if (isFavorite !== undefined) updateData.isFavorite = isFavorite;
    
    const updatedSummary = await SavedSummary.findByIdAndUpdate(
      params.id,
      updateData,
      { new: true, runValidators: true }
    ).lean();
    
    if (!updatedSummary) {
      return NextResponse.json(
        { success: false, error: 'Summary not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: updatedSummary,
      message: 'Summary updated successfully!'
    });
  } catch (error) {
    console.error('Error updating summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update summary' },
      { status: 500 }
    );
  }
}

// DELETE - Delete summary
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    const deletedSummary = await SavedSummary.findByIdAndDelete(params.id);
    
    if (!deletedSummary) {
      return NextResponse.json(
        { success: false, error: 'Summary not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Summary deleted successfully!'
    });
  } catch (error) {
    console.error('Error deleting summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete summary' },
      { status: 500 }
    );
  }
}