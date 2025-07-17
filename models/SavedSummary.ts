// models/SavedSummary.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface ISavedSummary extends Document {
  _id: string;
  topic: string;
  summary: string;
  keyPoints: string[];
  totalArticles: number;
  generatedAt: Date;
  savedAt: Date;
  title?: string;
  tags?: string[];
  isFavorite?: boolean;
}

const SavedSummarySchema: Schema = new Schema({
  topic: {
    type: String,
    required: true,
    enum: ['health', 'business', 'technology', 'sports', 'entertainment', 'general']
  },
  summary: {
    type: String,
    required: true
  },
  keyPoints: [{
    type: String,
    required: true
  }],
  totalArticles: {
    type: Number,
    required: true
  },
  generatedAt: {
    type: Date,
    required: true
  },
  savedAt: {
    type: Date,
    default: Date.now
  },
  title: {
    type: String,
    default: ''
  },
  tags: [{
    type: String
  }],
  isFavorite: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Create index for better performance
SavedSummarySchema.index({ topic: 1, savedAt: -1 });
SavedSummarySchema.index({ isFavorite: 1 });

export default mongoose.models.SavedSummary || mongoose.model<ISavedSummary>('SavedSummary', SavedSummarySchema);