import { Octokit } from '@octokit/rest';
import { StoredNotesData } from '../api/types.js';
import { Note } from '../applescript/notes-extractor.js';
import { NoteSnapshot } from './note-snapshot-store.js';

export interface CloudStorage {
  saveNotes(data: StoredNotesData): Promise<void>;
  loadNotes(): Promise<StoredNotesData | null>;
}

export class GitHubGistStorage implements CloudStorage {
  private octokit: Octokit;
  private gistId: string | null = null;

  constructor(githubToken: string, gistId?: string) {
    this.octokit = new Octokit({ auth: githubToken });
    this.gistId = gistId || null;
  }

  /**
   * Save notes data to GitHub Gist
   */
  async saveNotes(data: StoredNotesData): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    const filename = 'note-operator-data.json';

    try {
      if (this.gistId) {
        // Update existing Gist
        await this.octokit.rest.gists.update({
          gist_id: this.gistId,
          files: {
            [filename]: {
              content,
            },
          },
        });
        console.log(`Updated Gist ${this.gistId} with notes data`);
      } else {
        // Create new Gist
        const response = await this.octokit.rest.gists.create({
          description: 'Note Operator - Daily Brief Data',
          public: false,
          files: {
            [filename]: {
              content,
            },
          },
        });
        if (!response.data.id) {
          throw new Error('Failed to create Gist: No ID returned');
        }
        this.gistId = response.data.id;
        console.log(`Created new Gist ${this.gistId} with notes data`);
        console.log(`Save this Gist ID to your config: ${this.gistId}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to save notes to GitHub Gist: ${error.message}`);
    }
  }

  /**
   * Load notes data from GitHub Gist
   */
  async loadNotes(): Promise<StoredNotesData | null> {
    if (!this.gistId) {
      return null;
    }

    try {
      const response = await this.octokit.rest.gists.get({
        gist_id: this.gistId,
      });

      if (!response.data.files) {
        return null;
      }

      const file = response.data.files['note-operator-data.json'];
      if (!file || !file.content) {
        return null;
      }

      return JSON.parse(file.content) as StoredNotesData;
    } catch (error: any) {
      if (error.status === 404) {
        console.log('Gist not found, starting fresh');
        return null;
      }
      throw new Error(`Failed to load notes from GitHub Gist: ${error.message}`);
    }
  }

  /**
   * Get the current Gist ID (useful for first-time setup)
   */
  getGistId(): string | null {
    return this.gistId;
  }
}

export class GitHubRepoStorage implements CloudStorage {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private filePath: string;

  constructor(githubToken: string, owner: string, repo: string, filePath: string = 'data/notes.json') {
    this.octokit = new Octokit({ auth: githubToken });
    this.owner = owner;
    this.repo = repo;
    this.filePath = filePath;
  }

  /**
   * Save notes data to GitHub repository file
   */
  async saveNotes(data: StoredNotesData): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    const encodedContent = Buffer.from(content).toString('base64');

    try {
      // Try to get existing file to get SHA (required for update)
      let sha: string | undefined;
      try {
        const existing = await this.octokit.rest.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: this.filePath,
        });

        if ('sha' in existing.data && existing.data.sha) {
          sha = existing.data.sha;
        }
      } catch (error: any) {
        if (error.status !== 404) {
          throw error;
        }
        // File doesn't exist yet, will create new
      }

      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: this.filePath,
        message: `Update notes data - ${new Date().toISOString()}`,
        content: encodedContent,
        sha,
      });

      console.log(`Saved notes data to ${this.owner}/${this.repo}/${this.filePath}`);
    } catch (error: any) {
      throw new Error(`Failed to save notes to GitHub repository: ${error.message}`);
    }
  }

  /**
   * Load notes data from GitHub repository file
   */
  async loadNotes(): Promise<StoredNotesData | null> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: this.filePath,
      });

      if (!('content' in response.data)) {
        return null;
      }

      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      return JSON.parse(content) as StoredNotesData;
    } catch (error: any) {
      if (error.status === 404) {
        console.log('Repository file not found, starting fresh');
        return null;
      }
      throw new Error(`Failed to load notes from GitHub repository: ${error.message}`);
    }
  }
}
