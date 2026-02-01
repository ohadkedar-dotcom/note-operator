import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { TimestampStore } from './storage/timestamp-store.js';
import { NoteSnapshotStore } from './storage/note-snapshot-store.js';
import { LLMFactory, LLMProvider } from './llm/llm-factory.js';
import { FileWriter } from './output/file-writer.js';
import { NotesWriter } from './output/notes-writer.js';
import { SlackWriter } from './output/slack-writer.js';
import { CronScheduler } from './scheduler/cron-scheduler.js';
import { ApiServer } from './api/server.js';
import { GitHubGistStorage, GitHubRepoStorage, CloudStorage } from './storage/cloud-storage.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Config {
  llmProvider: LLMProvider;
  outputDirectory: string;
  createAppleNote: boolean;
  timezone: string;
  slackWebhookUrl?: string | null;
  // API server configuration
  apiPort?: number;
  apiKey?: string;
  // Cloud storage configuration
  cloudStorageType?: 'github' | 'gist' | null;
  githubToken?: string;
  githubRepo?: string;
  githubOwner?: string;
  gistId?: string;
}

/**
 * Load configuration from config.json
 */
function loadConfig(): Config {
  try {
    const configPath = join(__dirname, '..', 'config.json');
    const configData = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    // Validate required fields
    if (!config.llmProvider || config.llmProvider !== 'anthropic') {
      throw new Error('Invalid or missing llmProvider in config.json. Only "anthropic" is supported.');
    }

    return {
      llmProvider: config.llmProvider as LLMProvider,
      outputDirectory: config.outputDirectory || '~/Documents/DailyBriefs',
      createAppleNote: config.createAppleNote || false,
      timezone: config.timezone || 'America/New_York',
      slackWebhookUrl: config.slackWebhookUrl || null,
      apiPort: config.apiPort || 3000,
      apiKey: config.apiKey || process.env.API_KEY || undefined,
      cloudStorageType: config.cloudStorageType || null,
      githubToken: config.githubToken || process.env.GITHUB_TOKEN || undefined,
      githubRepo: config.githubRepo || undefined,
      githubOwner: config.githubOwner || undefined,
      gistId: config.gistId || process.env.GIST_ID || undefined,
    };
  } catch (error: any) {
    throw new Error(`Failed to load config: ${error.message}`);
  }
}

/**
 * Validate API keys are present
 */
function validateApiKeys(provider: LLMProvider): void {
  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    console.log('=== Daily Notes Brief Generator ===\n');

    // Load configuration
    const config = loadConfig();
    console.log(`Configuration loaded: LLM Provider = ${config.llmProvider}`);

    // Validate API keys
    validateApiKeys(config.llmProvider);
    console.log('API keys validated');

    // Initialize services
    const timestampStore = new TimestampStore();
    const llmService = LLMFactory.create(config.llmProvider, {
      anthropic: process.env.ANTHROPIC_API_KEY,
    });
    const fileWriter = new FileWriter(config.outputDirectory);
    const notesWriter = config.createAppleNote ? new NotesWriter() : undefined;
    const slackWriter = config.slackWebhookUrl ? new SlackWriter(config.slackWebhookUrl) : undefined;

    if (slackWriter) {
      console.log('Slack integration enabled');
    }

    // Create scheduler
    const scheduler = new CronScheduler({
      llmService,
      timestampStore,
      fileWriter,
      notesWriter,
      slackWriter,
      createAppleNote: config.createAppleNote,
      timezone: config.timezone,
    });

    // Check for command line arguments
    const args = process.argv.slice(2);
    const runNow = args.includes('--now') || args.includes('-n');
    const dryRun = args.includes('--dry-run') || args.includes('-d');
    const apiMode = args.includes('--api') || args.includes('-a');

    // API Server Mode
    if (apiMode) {
      if (!config.apiKey) {
        throw new Error('API key is required for API server mode. Set apiKey in config.json or API_KEY in .env');
      }

      if (!config.cloudStorageType || !config.githubToken) {
        throw new Error('Cloud storage configuration is required for API server mode. Set cloudStorageType and githubToken in config.json');
      }

      // Initialize cloud storage
      let cloudStorage: CloudStorage;
      if (config.cloudStorageType === 'gist' || config.cloudStorageType === 'github') {
        if (!config.githubToken) {
          throw new Error('githubToken is required for GitHub storage');
        }
        cloudStorage = new GitHubGistStorage(config.githubToken, config.gistId);
        console.log('Using GitHub Gist storage');
      } else {
        throw new Error(`Unsupported cloud storage type: ${config.cloudStorageType}`);
      }

      const timestampStore = new TimestampStore();
      const noteSnapshotStore = new NoteSnapshotStore();

      const apiServer = new ApiServer({
        port: config.apiPort!,
        apiKey: config.apiKey,
        cloudStorage,
        timestampStore,
        noteSnapshotStore,
      });

      await apiServer.start();

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\nReceived SIGINT, shutting down gracefully...');
        await apiServer.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log('\nReceived SIGTERM, shutting down gracefully...');
        await apiServer.stop();
        process.exit(0);
      });

      console.log('API server running. Press Ctrl+C to stop.\n');
      return;
    }

    // Normal mode (cron scheduler)
    if (dryRun) {
      console.log('Dry-run mode: Processing notes without LLM call');
      // In dry-run, we'd skip the LLM call - for now just log
      console.log('Dry-run mode not fully implemented yet');
      return;
    }

    if (runNow) {
      // Run immediately for testing
      await scheduler.runNow();
      return;
    }

    // Start the cron scheduler
    scheduler.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nReceived SIGINT, shutting down gracefully...');
      scheduler.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\nReceived SIGTERM, shutting down gracefully...');
      scheduler.stop();
      process.exit(0);
    });

    console.log('Service running. Press Ctrl+C to stop.');
    console.log('Use --now flag to run immediately for testing.\n');

  } catch (error: any) {
    console.error('Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
