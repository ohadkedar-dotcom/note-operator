import { DailyBrief } from '../llm/llm-service.js';

export class SlackWriter {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    if (!webhookUrl || webhookUrl.trim() === '') {
      throw new Error('Slack webhook URL is required');
    }
    this.webhookUrl = webhookUrl.trim();
  }

  /**
   * Post daily brief to Slack channel
   */
  async postDailyBrief(brief: DailyBrief, date: Date = new Date()): Promise<void> {
    const dateStr = this.formatDate(date);
    const fallbackText = this.formatSlackMessage(brief, date);

    const payload = {
      text: fallbackText,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `Daily Brief - ${dateStr}`,
            emoji: true,
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Executive Summary*\n${brief.executiveSummary}`,
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: this.formatActionItems(brief),
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_Generated on ${new Date().toLocaleString()}_`,
            },
          ],
        },
      ],
    };

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slack API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      console.log('Daily brief posted to Slack successfully');
    } catch (error: any) {
      throw new Error(`Failed to post to Slack: ${error.message}`);
    }
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format action items for Slack
   */
  private formatActionItems(brief: DailyBrief): string {
    if (brief.actionItems.length === 0) {
      return '*Action Items*\n_No action items identified._';
    }

    // Group by priority
    const highPriority = brief.actionItems.filter(item => item.priority === 'High');
    const mediumPriority = brief.actionItems.filter(item => item.priority === 'Medium');
    const lowPriority = brief.actionItems.filter(item => item.priority === 'Low');

    let text = '*Action Items*\n\n';

    if (highPriority.length > 0) {
      text += '*High Priority*\n';
      highPriority.forEach(item => {
        text += `• ${item.task}\n`;
      });
      text += '\n';
    }

    if (mediumPriority.length > 0) {
      text += '*Medium Priority*\n';
      mediumPriority.forEach(item => {
        text += `• ${item.task}\n`;
      });
      text += '\n';
    }

    if (lowPriority.length > 0) {
      text += '*Low Priority*\n';
      lowPriority.forEach(item => {
        text += `• ${item.task}\n`;
      });
      text += '\n';
    }

    return text.trim();
  }

  /**
   * Format brief content as plain Slack message (fallback)
   */
  private formatSlackMessage(brief: DailyBrief, date: Date): string {
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let content = `*Daily Brief - ${dateStr}*\n\n`;
    content += `*Executive Summary*\n${brief.executiveSummary}\n\n`;
    content += this.formatActionItems(brief);
    content += `\n\n_Generated on ${new Date().toLocaleString()}_`;

    return content;
  }
}
