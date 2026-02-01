import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export interface NoteSnapshot {
  name: string;
  body: string;
  modificationDate: string; // ISO-8601 timestamp
}

export interface NoteSnapshots {
  lastRun: string; // ISO-8601 timestamp
  notes: { [noteName: string]: NoteSnapshot };
}

const DEFAULT_STORAGE_DIR = join(homedir(), '.note-operator');
const DEFAULT_SNAPSHOT_FILE = join(DEFAULT_STORAGE_DIR, 'note-snapshots.json');

export class NoteSnapshotStore {
  private storagePath: string;

  constructor(storagePath?: string) {
    this.storagePath = storagePath || DEFAULT_SNAPSHOT_FILE;
  }

  /**
   * Get previous note snapshots
   */
  async getSnapshots(): Promise<NoteSnapshots | null> {
    try {
      const data = await readFile(this.storagePath, 'utf-8');
      return JSON.parse(data) as NoteSnapshots;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet - first run
        return null;
      }
      throw new Error(`Failed to read note snapshots: ${error.message}`);
    }
  }

  /**
   * Save current note snapshots
   */
  async saveSnapshots(notes: NoteSnapshot[], timestamp: Date): Promise<void> {
    const snapshots: NoteSnapshots = {
      lastRun: timestamp.toISOString(),
      notes: {},
    };

    // Index notes by name (assuming note names are unique identifiers)
    for (const note of notes) {
      snapshots.notes[note.name] = note;
    }

    try {
      // Ensure directory exists
      const dir = this.storagePath.substring(0, this.storagePath.lastIndexOf('/'));
      await mkdir(dir, { recursive: true });
      
      await writeFile(this.storagePath, JSON.stringify(snapshots, null, 2), 'utf-8');
    } catch (error: any) {
      throw new Error(`Failed to write note snapshots: ${error.message}`);
    }
  }

  /**
   * Get previous snapshot for a specific note
   */
  async getNoteSnapshot(noteName: string): Promise<NoteSnapshot | null> {
    const snapshots = await this.getSnapshots();
    if (!snapshots) {
      console.log(`  [SnapshotStore] No snapshots file found`);
      return null;
    }
    
    const snapshot = snapshots.notes[noteName];
    if (!snapshot) {
      console.log(`  [SnapshotStore] No snapshot found for note: "${noteName}"`);
      console.log(`  [SnapshotStore] Available note names (first 5): ${Object.keys(snapshots.notes).slice(0, 5).join(', ')}`);
      return null;
    }
    
    console.log(`  [SnapshotStore] Found snapshot for note: "${noteName}"`);
    return snapshot;
  }
}
