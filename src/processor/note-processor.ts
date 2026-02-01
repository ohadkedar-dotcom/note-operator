import { Note } from '../applescript/notes-extractor.js';
import { TimestampStore } from '../storage/timestamp-store.js';
import { NoteSnapshotStore } from '../storage/note-snapshot-store.js';

export interface ProcessedNotes {
  notes: Note[];
  aggregatedContent: string;
  cutoffDate: Date;
}

/**
 * Process notes to filter those modified in the last 24 hours
 * and aggregate their content for LLM processing
 */
export class NoteProcessor {
  private timestampStore: TimestampStore;
  private snapshotStore: NoteSnapshotStore;

  constructor(timestampStore: TimestampStore, snapshotStore?: NoteSnapshotStore) {
    this.timestampStore = timestampStore;
    this.snapshotStore = snapshotStore || new NoteSnapshotStore();
  }

  /**
   * Filter notes modified within the last 24 hours and aggregate content
   */
  async processNotes(allNotes: Note[]): Promise<ProcessedNotes> {
    const cutoffDate = await this.timestampStore.getCutoffDate();
    const now = new Date();
    
    // Debug: Show some sample note dates
    console.log(`\n=== Date Comparison Debug ===`);
    console.log(`Cutoff date: ${cutoffDate.toISOString()}`);
    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Time window: ${Math.round((now.getTime() - cutoffDate.getTime()) / 1000)} seconds`);
    
    // Show sample of all notes with their modification dates
    console.log(`\nSample of ALL notes (first 10) with modification dates:`);
    allNotes.slice(0, 10).forEach((note, idx) => {
      const isAfterCutoff = note.modificationDate >= cutoffDate;
      const secondsAgo = Math.round((now.getTime() - note.modificationDate.getTime()) / 1000);
      console.log(`  ${idx + 1}. "${note.name}" - Modified: ${note.modificationDate.toISOString()} (${secondsAgo}s ago) - ${isAfterCutoff ? 'INCLUDED' : 'EXCLUDED'}`);
    });
    
    // Filter notes modified after the cutoff date
    const filteredNotes = allNotes.filter(note => {
      return note.modificationDate >= cutoffDate;
    });
    
    console.log(`\nFiltered ${filteredNotes.length} notes out of ${allNotes.length} total`);
    console.log(`=== End Date Comparison Debug ===\n`);

    // Sort by modification date (newest first)
    filteredNotes.sort((a, b) => 
      b.modificationDate.getTime() - a.modificationDate.getTime()
    );

    // Aggregate content into a single text dump (only new content)
    const aggregatedContent = await this.aggregateContent(filteredNotes);

    return {
      notes: filteredNotes,
      aggregatedContent,
      cutoffDate,
    };
  }

  /**
   * Extract only the new content that was added since the last snapshot
   * Uses line-by-line comparison: only includes lines that are new or edited
   */
  private async extractNewContent(currentNote: Note): Promise<string> {
    const previousSnapshot = await this.snapshotStore.getNoteSnapshot(currentNote.name);
    
    console.log(`\n=== Extracting new content for note: "${currentNote.name}" ===`);
    
    if (!previousSnapshot) {
      // No previous snapshot - this is a new note, return all content
      console.log(`  ⚠️  No previous snapshot found - returning all content (${currentNote.body.length} chars)`);
      console.log(`  This is expected on first run. On second run, it should only extract new content.`);
      return currentNote.body;
    }

    const previousBody = previousSnapshot.body;
    const currentBody = currentNote.body;

    console.log(`  Previous body length: ${previousBody.length} chars`);
    console.log(`  Current body length: ${currentBody.length} chars`);

    // Split into lines (preserving line breaks)
    const previousLines = previousBody.split(/\r?\n/);
    const currentLines = currentBody.split(/\r?\n/);

    console.log(`  Previous lines: ${previousLines.length}`);
    console.log(`  Current lines: ${currentLines.length}`);

    // Create a Set of previous lines for fast lookup (normalized - trim whitespace for comparison)
    const previousLinesSet = new Set<string>();
    for (const line of previousLines) {
      const normalized = line.trim();
      if (normalized.length > 0) {
        previousLinesSet.add(normalized);
      }
    }

    // Extract only lines that are new or edited
    const newLines: string[] = [];
    for (const line of currentLines) {
      const normalized = line.trim();
      
      // Include the line if:
      // 1. It's not empty AND it doesn't exist in previous snapshot (new line)
      // 2. OR if it's empty but we want to preserve structure (we'll skip empty lines for now)
      if (normalized.length > 0 && !previousLinesSet.has(normalized)) {
        newLines.push(line);
        console.log(`  + New/edited line: "${line.substring(0, 80)}${line.length > 80 ? '...' : ''}"`);
      }
    }

    const extractedContent = newLines.join('\n');
    console.log(`  ✓ Extracted ${newLines.length} new/edited lines (${extractedContent.length} chars)`);
    
    if (extractedContent.length > 0) {
      console.log(`  Extracted content: "${extractedContent.substring(0, 200)}${extractedContent.length > 200 ? '...' : ''}"`);
    } else {
      console.log(`  ⚠️  No new or edited lines found`);
    }

    return extractedContent;
  }


  /**
   * Aggregate note content into a formatted text dump for LLM processing
   * Only includes new content that was added since the last snapshot
   */
  private async aggregateContent(notes: Note[]): Promise<string> {
    if (notes.length === 0) {
      return 'No notes were modified in the last 24 hours.';
    }

    const sections: string[] = [];
    
    for (let index = 0; index < notes.length; index++) {
      const note = notes[index];
      const newContent = await this.extractNewContent(note);
      
      if (newContent.trim()) {
        const dateStr = note.modificationDate.toLocaleString();
        sections.push(`--- Note ${index + 1}: ${note.name} (Modified: ${dateStr}) ---\n${newContent}\n`);
      }
    }

    if (sections.length === 0) {
      return 'No new content was added to notes in the last 24 hours.';
    }

    return sections.join('\n\n');
  }

  /**
   * Get count of notes that will be processed
   */
  async getFilteredNoteCount(allNotes: Note[]): Promise<number> {
    const cutoffDate = await this.timestampStore.getCutoffDate();
    return allNotes.filter(note => note.modificationDate >= cutoffDate).length;
  }
}
