import express, { Request, Response } from 'express';
import { extractNotes } from '../applescript/notes-extractor.js';
import { NoteProcessor } from '../processor/note-processor.js';
import { TimestampStore } from '../storage/timestamp-store.js';
import { NoteSnapshotStore } from '../storage/note-snapshot-store.js';
import { CloudStorage } from '../storage/cloud-storage.js';
import { ExtractNotesRequest, ExtractNotesResponse, StoredNotesData } from './types.js';

export interface ApiServerConfig {
  port: number;
  apiKey: string;
  cloudStorage: CloudStorage;
  timestampStore: TimestampStore;
  noteSnapshotStore: NoteSnapshotStore;
}

export class ApiServer {
  private app: express.Application;
  private config: ApiServerConfig;
  private server: any;

  constructor(config: ApiServerConfig) {
    this.config = config;
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Extract notes endpoint
    this.app.post('/api/extract-notes', async (req: Request, res: Response) => {
      try {
        // Authenticate request
        const requestData = req.body as ExtractNotesRequest;
        if (!requestData.apiKey || requestData.apiKey !== this.config.apiKey) {
          res.status(401).json({
            success: false,
            message: 'Invalid or missing API key',
          } as ExtractNotesResponse);
          return;
        }

        console.log('API: Extracting notes...');
        
        // Step 1: Extract all notes
        const allNotes = await extractNotes();
        console.log(`API: Found ${allNotes.length} total notes`);

        // Step 2: Process notes
        const processor = new NoteProcessor(this.config.timestampStore, this.config.noteSnapshotStore);
        const processed = await processor.processNotes(allNotes);
        console.log(`API: Processed ${processed.notes.length} notes from last 24 hours`);

        // Step 3: Prepare data for storage
        // Only store filtered notes (not all snapshots) to keep Gist size manageable
        // Convert Date objects to ISO strings for JSON serialization
        const notesForStorage = processed.notes.map(note => ({
          name: note.name,
          body: note.body,
          modificationDate: note.modificationDate.toISOString(),
        }));

        const lastRun = await this.config.timestampStore.getLastRun();
        // Store only aggregated content to minimize Gist size
        // Individual notes are not needed for GitHub Actions workflow
        const storedData: StoredNotesData = {
          notes: [], // Don't store individual notes - too large. Only store aggregated content.
          aggregatedContent: processed.aggregatedContent, // Store pre-aggregated content for GitHub Actions
          snapshots: {}, // Don't store all snapshots - they're too large.
          timestamp: new Date().toISOString(),
          cutoffDate: processed.cutoffDate.toISOString(),
          lastRun: lastRun ? lastRun.toISOString() : null,
        };

        // Step 5: Save to cloud storage
        await this.config.cloudStorage.saveNotes(storedData);
        console.log('API: Saved notes data to cloud storage');

        // Step 6: Update local snapshots and timestamp
        const currentSnapshots = allNotes.map(note => ({
          name: note.name,
          body: note.body,
          modificationDate: note.modificationDate.toISOString(),
        }));
        await this.config.noteSnapshotStore.saveSnapshots(currentSnapshots, new Date());
        await this.config.timestampStore.updateLastRun();

        const response: ExtractNotesResponse = {
          success: true,
          message: 'Notes extracted and stored successfully',
          notesCount: processed.notes.length,
          timestamp: storedData.timestamp,
        };

        res.json(response);
      } catch (error: any) {
        console.error('API Error:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Internal server error',
        } as ExtractNotesResponse);
      }
    });
  }

  /**
   * Start the API server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, () => {
          console.log(`API server started on port ${this.config.port}`);
          console.log(`Health check: http://localhost:${this.config.port}/api/health`);
          console.log(`Extract notes: POST http://localhost:${this.config.port}/api/extract-notes`);
          resolve();
        });

        this.server.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            reject(new Error(`Port ${this.config.port} is already in use`));
          } else {
            reject(error);
          }
        });
      } catch (error: any) {
        reject(error);
      }
    });
  }

  /**
   * Stop the API server
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((error: any) => {
          if (error) {
            reject(error);
          } else {
            console.log('API server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}
