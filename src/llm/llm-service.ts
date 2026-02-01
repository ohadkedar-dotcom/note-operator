export interface ActionItem {
  task: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface DailyBrief {
  executiveSummary: string;
  actionItems: ActionItem[];
}

/**
 * Abstract interface for LLM services
 */
export interface LLMService {
  generateBrief(content: string): Promise<DailyBrief>;
}
