import cron from 'node-cron';
import { extractNotes } from '../applescript/notes-extractor.js';
import { NoteProcessor } from '../processor/note-processor.js';
import { LLMService } from '../llm/llm-service.js';
import { TimestampStore } from '../storage/timestamp-store.js';
import { NoteSnapshotStore } from '../storage/note-snapshot-store.js';
import { FileWriter } from '../output/file-writer.js';
import { NotesWriter } from '../output/notes-writer.js';
import { SlackWriter } from '../output/slack-writer.js';

export interface SchedulerConfig {
  llmService: LLMService;
  timestampStore: TimestampStore;
  fileWriter: FileWriter;
  notesWriter?: NotesWriter;
  slackWriter?: SlackWriter;
  createAppleNote: boolean;
  timezone?: string;
}

export class CronScheduler {
  private config: SchedulerConfig;
  private cronJob: cron.ScheduledTask | null = null;

  constructor(config: SchedulerConfig) {
    this.config = config;
  }

  /**
   * Start the cron scheduler to run daily at 6:00 PM
   */
  start(): void {
    // Schedule for 6:00 PM daily (18:00)
    // Cron format: minute hour day month day-of-week
    const cronExpression = '0 18 * * *';
    
    this.cronJob = cron.schedule(
      cronExpression,
      async () => {
        console.log(`[${new Date().toISOString()}] Scheduled daily brief generation triggered`);
        await this.executeDailyBrief();
      },
      {
        scheduled: true,
        timezone: this.config.timezone || 'America/New_York',
      }
    );

    console.log('Cron scheduler started. Daily brief will run at 6:00 PM.');
  }

  /**
   * Stop the cron scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('Cron scheduler stopped.');
    }
  }

  /**
   * Execute the daily brief generation process
   */
  async executeDailyBrief(): Promise<void> {
    try {
      console.log('Starting daily brief generation...');

      // Step 1: Extract all notes
      console.log('Extracting notes from Apple Notes...');
      const allNotes = await extractNotes();
      console.log(`Found ${allNotes.length} total notes`);

      // Step 2: Process and filter notes
      const processor = new NoteProcessor(this.config.timestampStore);
      const processed = await processor.processNotes(allNotes);
      
      // Log filtering details for verification
      console.log(`\n=== Filtering Details ===`);
      console.log(`Cutoff date (24 hour window): ${processed.cutoffDate.toISOString()}`);
      console.log(`Current time: ${new Date().toISOString()}`);
      console.log(`Time difference: ${Math.round((new Date().getTime() - processed.cutoffDate.getTime()) / 3600 * 10) / 10} hours`);
      console.log(`Total notes extracted: ${allNotes.length}`);
      console.log(`Notes modified in last 24 hours: ${processed.notes.length}`);
      
      // Show sample of filtered note dates for verification
      if (processed.notes.length > 0) {
        console.log(`\nSample of filtered note modification dates:`);
        processed.notes.slice(0, 5).forEach((note, idx) => {
          console.log(`  ${idx + 1}. "${note.name}" - Modified: ${note.modificationDate.toISOString()}`);
        });
        if (processed.notes.length > 5) {
          console.log(`  ... and ${processed.notes.length - 5} more`);
        }
      }
      console.log(`=== End of Filtering Details ===\n`);

      if (processed.notes.length === 0) {
        console.log('No notes to process. Skipping LLM call.');
        // Still update timestamp to avoid reprocessing
        await this.config.timestampStore.updateLastRun();
        return;
      }

      // Log the raw aggregated content that will be sent to LLM
      console.log('\n=== Raw extracted content (last 24 hours) - SENT TO LLM ===');
      console.log(processed.aggregatedContent);
      console.log('=== End of extracted content ===\n');

      // Step 3: Generate brief using LLM
      console.log('Generating brief with LLM...');
      const brief = await this.config.llmService.generateBrief(processed.aggregatedContent);
      console.log(`Generated brief with ${brief.actionItems.length} action items`);

      // Step 4: Write output files
      console.log('Writing output files...');
      const filepath = await this.config.fileWriter.writeDailyBrief(brief);
      console.log(`Daily brief saved to: ${filepath}`);

      // Step 5: Optionally post to Slack
      if (this.config.slackWriter) {
        console.log('Posting to Slack...');
        try {
          await this.config.slackWriter.postDailyBrief(brief);
          console.log('Slack post completed successfully');
        } catch (error: any) {
          console.error(`Failed to post to Slack: ${error.message}`);
          // Don't throw - continue with other outputs
        }
      }

      // Step 6: Optionally create Apple Note
      if (this.config.createAppleNote && this.config.notesWriter) {
        console.log('Creating Apple Note...');
        await this.config.notesWriter.createDailyBriefNote(brief);
        console.log('Apple Note created successfully');
      }

      // Step 7: Save note snapshots for next run's diff comparison
      // Save ALL notes (not just filtered) to have complete baseline
      const snapshotStore = new NoteSnapshotStore();
      const now = new Date();
      const snapshotData = allNotes.map(note => ({
        name: note.name,
        body: note.body,
        modificationDate: note.modificationDate.toISOString(),
      }));
      await snapshotStore.saveSnapshots(snapshotData, now);
      console.log(`Note snapshots saved for ${allNotes.length} notes (for next run's diff comparison)`);

      // Step 8: Update last run timestamp
      await this.config.timestampStore.updateLastRun();
      console.log('Daily brief generation completed successfully');

    } catch (error: any) {
      console.error(`Error during daily brief generation: ${error.message}`);
      console.error(error.stack);
      // Don't throw - allow scheduler to continue
    }
  }

  /**
   * Run immediately (for testing)
   */
  async runNow(): Promise<void> {
    console.log('Running daily brief generation immediately (test mode)...');
    await this.executeDailyBrief();
  }
}
