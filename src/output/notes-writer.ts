import { exec } from 'child_process';
import { promisify } from 'util';
import { DailyBrief } from '../llm/llm-service.js';

const execAsync = promisify(exec);

export class NotesWriter {
  /**
   * Create a new Apple Note with the daily brief content
   */
  async createDailyBriefNote(brief: DailyBrief, date: Date = new Date()): Promise<void> {
    const dateStr = this.formatDate(date);
    const title = `Daily Brief: ${dateStr}`;
    const content = this.formatNoteContent(brief, date);

    // Escape content for AppleScript
    const escapedTitle = this.escapeForAppleScript(title);
    const escapedContent = this.escapeForAppleScript(content);

    const appleScript = `
      tell application "Notes"
        tell account "iCloud"
          make new note at folder "Notes" with properties {name: "${escapedTitle}", body: "${escapedContent}"}
        end tell
      end tell
    `;

    try {
      await execAsync(`osascript -e '${appleScript}'`);
    } catch (error: any) {
      // Try alternative approach if iCloud account doesn't exist
      try {
        const fallbackScript = `
          tell application "Notes"
            make new note with properties {name: "${escapedTitle}", body: "${escapedContent}"}
          end tell
        `;
        await execAsync(`osascript -e '${fallbackScript}'`);
      } catch (fallbackError: any) {
        throw new Error(`Failed to create Apple Note: ${fallbackError.message}`);
      }
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
   * Format brief content for Apple Note (simplified markdown)
   */
  private formatNoteContent(brief: DailyBrief, date: Date): string {
    const dateStr = date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    let content = `Daily Brief - ${dateStr}\n\n`;
    content += `Generated on ${new Date().toLocaleString()}\n\n`;
    content += `---\n\n`;

    // Executive Summary
    content += `EXECUTIVE SUMMARY\n\n`;
    content += `${brief.executiveSummary}\n\n`;
    content += `---\n\n`;

    // Action Items
    content += `ACTION ITEMS\n\n`;

    if (brief.actionItems.length === 0) {
      content += `No action items identified.\n`;
    } else {
      // Group by priority
      const highPriority = brief.actionItems.filter(item => item.priority === 'High');
      const mediumPriority = brief.actionItems.filter(item => item.priority === 'Medium');
      const lowPriority = brief.actionItems.filter(item => item.priority === 'Low');

      if (highPriority.length > 0) {
        content += `HIGH PRIORITY:\n`;
        highPriority.forEach(item => {
          content += `• ${item.task}\n`;
        });
        content += `\n`;
      }

      if (mediumPriority.length > 0) {
        content += `MEDIUM PRIORITY:\n`;
        mediumPriority.forEach(item => {
          content += `• ${item.task}\n`;
        });
        content += `\n`;
      }

      if (lowPriority.length > 0) {
        content += `LOW PRIORITY:\n`;
        lowPriority.forEach(item => {
          content += `• ${item.task}\n`;
        });
        content += `\n`;
      }
    }

    return content;
  }

  /**
   * Escape special characters for AppleScript
   */
  private escapeForAppleScript(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }
}
