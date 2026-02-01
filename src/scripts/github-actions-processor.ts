/**
 * Script to process notes and generate daily brief in GitHub Actions
 * This script runs in the cloud and doesn't have access to Apple Notes
 */

import { AnthropicClient } from '../llm/anthropic-client.js';
import { SlackWriter } from '../output/slack-writer.js';
import { StoredNotesData } from '../api/types.js';
import { Note } from '../applescript/notes-extractor.js';
import { NoteProcessor } from '../processor/note-processor.js';
import { TimestampStore } from '../storage/timestamp-store.js';
import { NoteSnapshotStore } from '../storage/note-snapshot-store.js';
import { GitHubGistStorage } from '../storage/cloud-storage.js';

async function main() {
  try {
    console.log('=== GitHub Actions Daily Brief Processor ===\n');

    // Load stored notes data from GitHub Gist
    const githubToken = process.env.GITHUB_TOKEN;
    const gistId = process.env.GIST_ID;

    if (!githubToken || !gistId) {
      console.error('GITHUB_TOKEN and GIST_ID environment variables are required');
      console.error('Make sure these are set as GitHub Secrets');
      process.exit(1);
    }

    const cloudStorage = new GitHubGistStorage(githubToken, gistId);
    let storedData: StoredNotesData | null;

    try {
      storedData = await cloudStorage.loadNotes();
      if (!storedData) {
        console.error('No notes data found in Gist. Make sure notes have been extracted and stored via API.');
        process.exit(1);
      }
      console.log(`Loaded stored notes data (timestamp: ${storedData.timestamp})`);
    } catch (error: any) {
      console.error('Failed to load stored notes from Gist:', error.message);
      console.error('Make sure notes have been extracted and stored via API');
      process.exit(1);
    }

    // Convert stored notes back to Note objects (with Date objects)
    const notes: Note[] = storedData.notes.map(note => ({
      name: note.name,
      body: note.body,
      modificationDate: new Date(note.modificationDate),
    }));

    console.log(`Processing ${notes.length} notes from storage`);

    // For GitHub Actions, we don't have previous snapshots stored (to save space)
    // We'll process notes without diff comparison - this means we'll get full note content
    // which is fine since we're only processing notes from the last 24 hours anyway
    const snapshotStore = new NoteSnapshotStore();
    console.log('Processing notes without snapshot diff (snapshots not stored in Gist to save space)');

    // Create a temporary timestamp store that uses the stored cutoff date
    const cutoffDate = new Date(storedData.cutoffDate);
    const timestampStore = new class extends TimestampStore {
      async getCutoffDate(): Promise<Date> {
        return cutoffDate;
      }
    }();

    // Process notes
    const processor = new NoteProcessor(timestampStore, snapshotStore);
    const processed = await processor.processNotes(notes);

    if (processed.notes.length === 0) {
      console.log('No notes to process. Skipping LLM call.');
      process.exit(0);
    }

    console.log(`\n=== Processing ${processed.notes.length} notes ===`);
    console.log(`Aggregated content length: ${processed.aggregatedContent.length} characters`);

    // Generate brief using LLM
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    const llmService = new AnthropicClient(anthropicApiKey);
    console.log('Generating brief with LLM...');
    const brief = await llmService.generateBrief(processed.aggregatedContent);
    console.log(`Generated brief with ${brief.actionItems.length} action items`);

    // Post to Slack
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackWebhookUrl) {
      console.log('Posting to Slack...');
      const slackWriter = new SlackWriter(slackWebhookUrl);
      await slackWriter.postDailyBrief(brief);
      console.log('Posted to Slack successfully');
    } else {
      console.log('SLACK_WEBHOOK_URL not set, skipping Slack post');
    }

    // Update storage with new timestamp
    try {
      storedData.lastRun = new Date().toISOString();
      await cloudStorage.saveNotes(storedData);
      console.log('Updated storage with new timestamp');
    } catch (error: any) {
      console.error('Failed to update storage:', error.message);
      // Don't fail if storage update fails
    }

    console.log('\n=== Daily brief generation completed successfully ===');
    process.exit(0);
  } catch (error: any) {
    console.error('Error during daily brief generation:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
