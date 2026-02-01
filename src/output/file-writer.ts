import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { DailyBrief } from '../llm/llm-service.js';

export class FileWriter {
  private outputDirectory: string;

  constructor(outputDirectory?: string) {
    // Expand ~ to home directory
    const dir = outputDirectory || '~/Documents/DailyBriefs';
    this.outputDirectory = dir.startsWith('~') 
      ? dir.replace('~', homedir())
      : dir;
  }

  /**
   * Write daily brief to a Markdown file
   */
  async writeDailyBrief(brief: DailyBrief, date: Date = new Date()): Promise<string> {
    const dateStr = this.formatDate(date);
    const filename = `Daily_Summary_${dateStr}.md`;
    const filepath = join(this.outputDirectory, filename);

    // Ensure directory exists
    await mkdir(this.outputDirectory, { recursive: true });

    // Generate markdown content
    const content = this.generateMarkdown(brief, date);

    // Write file
    await writeFile(filepath, content, 'utf-8');

    return filepath;
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
   * Generate markdown content from brief
   */
  private generateMarkdown(brief: DailyBrief, date: Date): string {
    const dateStr = date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    let markdown = `# Daily Brief - ${dateStr}\n\n`;
    markdown += `*Generated on ${new Date().toLocaleString()}*\n\n`;
    markdown += `---\n\n`;

    // Executive Summary
    markdown += `## Executive Summary\n\n`;
    markdown += `${brief.executiveSummary}\n\n`;
    markdown += `---\n\n`;

    // Action Items
    markdown += `## Action Items\n\n`;

    if (brief.actionItems.length === 0) {
      markdown += `*No action items identified.*\n`;
    } else {
      // Group by priority
      const highPriority = brief.actionItems.filter(item => item.priority === 'High');
      const mediumPriority = brief.actionItems.filter(item => item.priority === 'Medium');
      const lowPriority = brief.actionItems.filter(item => item.priority === 'Low');

      if (highPriority.length > 0) {
        markdown += `### High Priority\n\n`;
        highPriority.forEach(item => {
          markdown += `- [ ] **${item.task}**\n`;
        });
        markdown += `\n`;
      }

      if (mediumPriority.length > 0) {
        markdown += `### Medium Priority\n\n`;
        mediumPriority.forEach(item => {
          markdown += `- [ ] ${item.task}\n`;
        });
        markdown += `\n`;
      }

      if (lowPriority.length > 0) {
        markdown += `### Low Priority\n\n`;
        lowPriority.forEach(item => {
          markdown += `- [ ] ${item.task}\n`;
        });
        markdown += `\n`;
      }
    }

    return markdown;
  }
}
