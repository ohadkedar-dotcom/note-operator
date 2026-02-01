import { Note } from '../applescript/notes-extractor.js';

export interface ExtractNotesRequest {
  apiKey: string;
}

export interface ExtractNotesResponse {
  success: boolean;
  message?: string;
  notesCount?: number;
  timestamp?: string;
}

export interface StoredNotesData {
  notes: Note[]; // Individual notes (for detailed processing if needed)
  aggregatedContent?: string; // Pre-aggregated content for LLM (optimized storage)
  snapshots: { [noteName: string]: { name: string; body: string; modificationDate: string } };
  timestamp: string;
  cutoffDate: string;
  lastRun: string | null;
}
