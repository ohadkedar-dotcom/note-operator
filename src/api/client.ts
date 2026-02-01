import { ExtractNotesRequest, ExtractNotesResponse } from './types.js';

export interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
}

export class ApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  /**
   * Call the extract-notes API endpoint
   */
  async extractNotes(): Promise<ExtractNotesResponse> {
    const request: ExtractNotesRequest = {
      apiKey: this.config.apiKey,
    };

    try {
      const response = await fetch(`${this.config.baseUrl}/api/extract-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json() as ExtractNotesResponse;
    } catch (error: any) {
      throw new Error(`Failed to call extract-notes API: ${error.message}`);
    }
  }

  /**
   * Check if the API server is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
