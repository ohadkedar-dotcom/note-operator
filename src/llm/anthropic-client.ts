import Anthropic from '@anthropic-ai/sdk';
import { LLMService, DailyBrief, ActionItem } from './llm-service.js';

export class AnthropicClient implements LLMService {
  private client: Anthropic;
  private model: string = 'claude-sonnet-4-5';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }
    this.client = new Anthropic({ apiKey });
  }

  async generateBrief(content: string): Promise<DailyBrief> {
    // Truncate content if it exceeds token limits
    // Claude 3.5 Sonnet has a 200k token context window, but we'll be conservative
    const maxChars = 200000; // Rough estimate for safety
    const truncatedContent = content.length > maxChars 
      ? content.substring(0, maxChars) + '\n\n[Content truncated due to length]'
      : content;

    if (content.length > maxChars) {
      console.warn(`Content truncated from ${content.length} to ${maxChars} characters`);
    }

    const prompt = this.buildPrompt(truncatedContent);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'anthropic-client.ts:29',message:'About to call Anthropic API',data:{model:this.model,promptLength:prompt.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'N'})}).catch(()=>{});
    // #endregion

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8192, // Increased to handle large action item lists
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'anthropic-client.ts:42',message:'Anthropic API call succeeded',data:{model:this.model,responseType:response.content[0]?.type},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'O'})}).catch(()=>{});
      // #endregion

      const contentText = response.content[0];
      if (contentText.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic');
      }

      const responseText = contentText.text;
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'anthropic-client.ts:46',message:'Received Anthropic response',data:{responseLength:responseText.length,responsePreview:responseText.substring(0,500),responseEnd:responseText.substring(Math.max(0,responseText.length-500))},timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'Q'})}).catch(()=>{});
      // #endregion
      
      return this.parseResponse(responseText);
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'anthropic-client.ts:50',message:'Anthropic API error',data:{model:this.model,errorMessage:error.message,errorStatus:error.status,errorBody:error.error||error.body||'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'P'})}).catch(()=>{});
      // #endregion
      throw new Error(`Anthropic API error: ${error.message}`);
    }
  }

  private buildPrompt(content: string): string {
    return `You are a high-level Chief of Staff. Below is a raw dump of notes taken in the last 24 hours. Synthesize this into:

1. Executive Summary: 3-5 sentences on the day's main themes and key events.

2. Action Items: A checklist of concrete tasks extracted from the text, each with a priority level (High, Medium, or Low).

IMPORTANT: For each action item, format it as "[Party/Topic]: [Action item]". Start with the involved party (person's name, team, or topic) followed by a colon, then the specific action to be done.

Examples:
- "Ben: Schedule follow-up meeting to discuss Q1 goals"
- "Product Team: Review and approve the new feature specification"
- "Recruitment: Kick off process for locomotive operator role"

CRITICAL: You MUST respond with valid JSON only. Do not include any markdown code blocks, explanations, or text outside the JSON object. The response must be parseable JSON.

Respond with ONLY this JSON structure (no other text):
{
  "executiveSummary": "Your 3-5 sentence summary here",
  "actionItems": [
    {
      "task": "Party/Topic: Action item description",
      "priority": "High"
    }
  ]
}

Ensure all strings are properly escaped, all arrays are properly closed, and there are no trailing commas.

Notes from the last 24 hours:
${content}`;
  }

  private parseResponse(response: string): DailyBrief {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'anthropic-client.ts:78',message:'Parsing Anthropic response',data:{responseLength:response.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'R'})}).catch(()=>{});
      // #endregion
      
      // Extract JSON from response (in case there's extra text)
      // Try to find JSON object - be more flexible with matching
      let jsonMatch = response.match(/\{[\s\S]*\}/);
      
      // If no match, try to find JSON that might have markdown code blocks
      if (!jsonMatch) {
        // Remove markdown code blocks if present
        const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      }
      
      if (!jsonMatch) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'anthropic-client.ts:90',message:'No JSON found in response',data:{responsePreview:response.substring(0,1000)},timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'S'})}).catch(()=>{});
        // #endregion
        throw new Error('No JSON found in Anthropic response');
      }

      let jsonString = jsonMatch[0];
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'anthropic-client.ts:97',message:'Extracted JSON string',data:{jsonLength:jsonString.length,jsonPreview:jsonString.substring(0,500),errorPosition:13776},timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'T'})}).catch(()=>{});
      // #endregion
      
      // Try to fix common JSON issues before parsing
      // Remove trailing commas in arrays/objects
      jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
      
      // Try to fix unescaped quotes in strings (basic attempt)
      // This is tricky, so we'll be conservative
      
      let parsed;
      try {
        parsed = JSON.parse(jsonString);
      } catch (parseError: any) {
        // #region agent log
        const positionMatch = parseError.message.match(/position (\d+)/);
        const errorPos = positionMatch ? parseInt(positionMatch[1], 10) : null;
        fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'anthropic-client.ts:142',message:'JSON parse error',data:{errorMessage:parseError.message,errorPosition:errorPos,jsonLength:jsonString.length,jsonEnd:jsonString.substring(Math.max(0,jsonString.length-300))},timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'U'})}).catch(()=>{});
        // #endregion
        
        // Check if JSON was truncated (error near the end of the string)
        if (errorPos && errorPos >= jsonString.length - 50) {
          console.warn(`JSON appears to be truncated at position ${errorPos} (length: ${jsonString.length})`);
          console.warn(`Attempting to fix truncated JSON by finding last complete action item...`);
          
          // Try to find the last complete action item and close the array properly
          const actionItemsStart = jsonString.indexOf('"actionItems"');
          if (actionItemsStart > 0) {
            // Find the opening bracket of actionItems array
            const arrayStart = jsonString.indexOf('[', actionItemsStart);
            if (arrayStart > 0) {
              // Find all complete action item objects
              // We'll parse manually by finding complete JSON objects
              const matches: { match: string; index: number }[] = [];
              
              // Find the start of the array content (after the opening bracket)
              const arrayContentStart = arrayStart + 1;
              let currentPos = arrayContentStart;
              
              // Try to parse objects one by one until we hit the error
              while (currentPos < errorPos && currentPos < jsonString.length) {
                // Skip whitespace and commas
                while (currentPos < jsonString.length && /[\s,\n]/.test(jsonString[currentPos])) {
                  currentPos++;
                }
                
                if (currentPos >= jsonString.length) break;
                
                // Look for opening brace
                if (jsonString[currentPos] === '{') {
                  // Try to find the matching closing brace
                  let braceCount = 0;
                  let inString = false;
                  let escapeNext = false;
                  let objStart = currentPos;
                  let objEnd = -1;
                  
                  for (let i = currentPos; i < jsonString.length && i < errorPos + 100; i++) {
                    const char = jsonString[i];
                    
                    if (escapeNext) {
                      escapeNext = false;
                      continue;
                    }
                    
                    if (char === '\\') {
                      escapeNext = true;
                      continue;
                    }
                    
                    if (char === '"') {
                      inString = !inString;
                      continue;
                    }
                    
                    if (!inString) {
                      if (char === '{') {
                        braceCount++;
                      } else if (char === '}') {
                        braceCount--;
                        if (braceCount === 0) {
                          objEnd = i + 1;
                          break;
                        }
                      }
                    }
                  }
                  
                  if (objEnd > 0) {
                    const objStr = jsonString.substring(objStart, objEnd);
                    // Verify it's a valid action item
                    if (objStr.includes('"task"') && objStr.includes('"priority"')) {
                      matches.push({ match: objStr, index: objStart });
                      currentPos = objEnd;
                    } else {
                      currentPos++;
                    }
                  } else {
                    // Incomplete object, stop here
                    break;
                  }
                } else {
                  currentPos++;
                }
              }
              
              console.log(`Found ${matches.length} complete action items before truncation`);
              
              if (matches.length > 0) {
                // Reconstruct JSON with properly closed array
                const beforeArray = jsonString.substring(0, arrayStart + 1);
                const items = matches.map(m => m.match).join(',\n    ');
                const fixedJson = beforeArray + '\n    ' + items + '\n  ]\n}';
                
                console.log(`Fixed truncated JSON: kept ${matches.length} complete action items`);
                try {
                  parsed = JSON.parse(fixedJson);
                  console.log('Successfully fixed truncated JSON');
                } catch (e: any) {
                  console.error(`Failed to fix JSON: ${e.message}`);
                  throw new Error(`Failed to parse Anthropic response (truncated): ${parseError.message}`);
                }
              } else {
                throw new Error(`Failed to parse Anthropic response (truncated, no complete items found): ${parseError.message}`);
              }
            } else {
              throw new Error(`Failed to parse Anthropic response (truncated): ${parseError.message}`);
            }
          } else {
            throw new Error(`Failed to parse Anthropic response (truncated): ${parseError.message}`);
          }
        } else {
          // Not truncated, try to fix other JSON issues
          // More aggressive trailing comma removal
          jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
          jsonString = jsonString.replace(/,(\s*\n\s*[}\]])/g, '$1');
          
          // Try parsing again
          try {
            parsed = JSON.parse(jsonString);
          } catch (e: any) {
            throw new Error(`Failed to parse Anthropic response: ${parseError.message}`);
          }
        }
      }
      
      // Validate structure
      if (!parsed.executiveSummary || !Array.isArray(parsed.actionItems)) {
        throw new Error('Invalid response structure from Anthropic');
      }

      // Validate and normalize action items
      const actionItems: ActionItem[] = parsed.actionItems
        .map((item: any) => {
          if (!item.task) return null;
          
          let priority = item.priority || 'Medium';
          if (!['High', 'Medium', 'Low'].includes(priority)) {
            priority = 'Medium';
          }
          
          return {
            task: String(item.task),
            priority: priority as 'High' | 'Medium' | 'Low',
          };
        })
        .filter((item: ActionItem | null): item is ActionItem => item !== null);

      return {
        executiveSummary: String(parsed.executiveSummary),
        actionItems,
      };
    } catch (error: any) {
      throw new Error(`Failed to parse Anthropic response: ${error.message}`);
    }
  }
}
