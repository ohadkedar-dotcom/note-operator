import { LLMService } from './llm-service.js';
import { AnthropicClient } from './anthropic-client.js';

export type LLMProvider = 'anthropic';

/**
 * Factory to create LLM service instances based on provider
 */
export class LLMFactory {
  static create(provider: LLMProvider, apiKeys: { anthropic?: string }): LLMService {
    switch (provider) {
      case 'anthropic':
        if (!apiKeys.anthropic) {
          throw new Error('Anthropic API key is required but not provided');
        }
        return new AnthropicClient(apiKeys.anthropic);
      
      default:
        throw new Error(`Unknown LLM provider: ${provider}`);
    }
  }
}
