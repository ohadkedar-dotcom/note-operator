import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export interface TimestampData {
  lastRun: string; // ISO-8601 timestamp
}

const DEFAULT_STORAGE_DIR = join(homedir(), '.note-operator');
const DEFAULT_STORAGE_FILE = join(DEFAULT_STORAGE_DIR, 'last-run.json');

export class TimestampStore {
  private storagePath: string;

  constructor(storagePath?: string) {
    this.storagePath = storagePath || DEFAULT_STORAGE_FILE;
  }

  /**
   * Get the last run timestamp, or null if it doesn't exist
   */
  async getLastRun(): Promise<Date | null> {
    try {
      const data = await readFile(this.storagePath, 'utf-8');
      const parsed: TimestampData = JSON.parse(data);
      return new Date(parsed.lastRun);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet - first run
        return null;
      }
      throw new Error(`Failed to read timestamp store: ${error.message}`);
    }
  }

  /**
   * Update the last run timestamp to the current time
   */
  async updateLastRun(timestamp?: Date): Promise<void> {
    const timestampToSave = timestamp || new Date();
    const data: TimestampData = {
      lastRun: timestampToSave.toISOString(),
    };

    try {
      // Ensure directory exists
      const dir = this.storagePath.substring(0, this.storagePath.lastIndexOf('/'));
      await mkdir(dir, { recursive: true });
      
      await writeFile(this.storagePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error: any) {
      throw new Error(`Failed to write timestamp store: ${error.message}`);
    }
  }

  /**
   * Get the cutoff date (24 hours before now, or 24 hours before last run if last run was recent)
   * This ensures we always get notes from the last 24 hours, not from an old timestamp
   */
  async getCutoffDate(): Promise<Date> {
    const lastRun = await this.getLastRun();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    if (!lastRun) {
      // First run - default to 24 hours ago
      return twentyFourHoursAgo;
    }
    
    // Use the more recent cutoff: either 24 hours before last run, or 24 hours before now
    // This ensures we always get the last 24 hours of notes
    const cutoffFromLastRun = new Date(lastRun);
    cutoffFromLastRun.setHours(cutoffFromLastRun.getHours() - 24);
    
    // Return the more recent cutoff to ensure we always get last 24 hours
    return cutoffFromLastRun > twentyFourHoursAgo ? cutoffFromLastRun : twentyFourHoursAgo;
  }
}
