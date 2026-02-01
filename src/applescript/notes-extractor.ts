import { exec } from 'child_process';
import { promisify } from 'util';
import { convert } from 'html-to-text';

const execAsync = promisify(exec);

export interface Note {
  name: string;
  body: string;
  modificationDate: Date;
}

/**
 * Extract all notes from Apple Notes using AppleScript
 */
export async function extractNotes(): Promise<Note[]> {
  // Use a delimiter-based approach for more reliable parsing
  const DELIMITER = '|||NOTE_DELIMITER|||';
  const FIELD_DELIMITER = '|||FIELD|||';
  
  // Build AppleScript with proper string concatenation
  const appleScript = [
    'tell application "Notes"',
    '  set output to ""',
    '  repeat with currentNote in notes',
    '    try',
    '      set noteName to name of currentNote',
    '      set noteBody to body of currentNote',
    '      set noteModDate to modification date of currentNote',
    `      set output to output & noteName & "${FIELD_DELIMITER}" & noteBody & "${FIELD_DELIMITER}" & (noteModDate as string) & "${DELIMITER}"`,
    '    on error errMsg',
    '      -- Skip notes that can\'t be accessed',
    '      log "Error accessing note: " & errMsg',
    '    end try',
    '  end repeat',
    '  return output',
    'end tell',
  ].join('\n');

  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notes-extractor.ts:40',message:'About to execute AppleScript',data:{scriptLength:appleScript.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Escape single quotes in the script for shell execution
    const escapedScript = appleScript.replace(/'/g, "'\\''");
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notes-extractor.ts:45',message:'Executing osascript with increased maxBuffer',data:{maxBuffer:10*1024*1024},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Increase maxBuffer to 10MB to handle large note collections
    const { stdout, stderr } = await execAsync(`osascript -e '${escapedScript}'`, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notes-extractor.ts:52',message:'AppleScript execution completed',data:{stdoutLength:stdout?.length||0,stderrLength:stderr?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    if (stderr && !stderr.includes('log')) {
      console.warn('AppleScript warnings:', stderr);
    }

    // Parse the AppleScript output using delimiters
    const notes = parseAppleScriptOutput(stdout, DELIMITER, FIELD_DELIMITER);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notes-extractor.ts:63',message:'Notes parsed successfully',data:{noteCount:notes.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    return notes;
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notes-extractor.ts:67',message:'Error during note extraction',data:{errorMessage:error.message,errorCode:error.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    throw new Error(`Failed to extract notes from Apple Notes: ${error.message}`);
  }
}

/**
 * Parse AppleScript output and convert to Note objects
 * Uses delimiter-based parsing for reliability
 */
function parseAppleScriptOutput(output: string, noteDelimiter: string, fieldDelimiter: string): Note[] {
  const notes: Note[] = [];
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notes-extractor.ts:85',message:'Starting parseAppleScriptOutput',data:{outputLength:output?.length||0,outputPreview:output?.substring(0,200)||'',hasDelimiter:output?.includes(noteDelimiter)||false,hasFieldDelimiter:output?.includes(fieldDelimiter)||false},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  
  if (!output || !output.trim()) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notes-extractor.ts:92',message:'Output is empty or whitespace',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    return notes;
  }
  
  try {
    // Split by note delimiter
    const noteStrings = output.split(noteDelimiter).filter(note => note.trim());
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notes-extractor.ts:98',message:'After splitting by note delimiter',data:{noteStringsCount:noteStrings.length,firstNotePreview:noteStrings[0]?.substring(0,200)||''},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    
    for (const noteString of noteStrings) {
      const fields = noteString.split(fieldDelimiter);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notes-extractor.ts:103',message:'Processing note string',data:{fieldsCount:fields.length,field0Preview:fields[0]?.substring(0,50)||''},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
      
      if (fields.length >= 3) {
        const name = fields[0].trim();
        const body = fields[1].trim();
        const dateStr = fields[2].trim();
        
        try {
          const modDate = parseAppleScriptDate(dateStr);
          const cleanBody = stripHtmlTags(body);
          
          notes.push({
            name: name,
            body: cleanBody,
            modificationDate: modDate,
          });
        } catch (error) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notes-extractor.ts:118',message:'Failed to parse individual note',data:{name:name,errorMessage:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'J'})}).catch(()=>{});
          // #endregion
          console.warn(`Failed to parse note "${name}":`, error);
        }
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notes-extractor.ts:125',message:'Note string has insufficient fields',data:{fieldsCount:fields.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'K'})}).catch(()=>{});
        // #endregion
      }
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notes-extractor.ts:131',message:'Parse complete',data:{totalNotes:notes.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'L'})}).catch(()=>{});
    // #endregion
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4a845933-93aa-4d22-b88f-8e26cd96f188',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notes-extractor.ts:135',message:'Error in parseAppleScriptOutput',data:{errorMessage:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'M'})}).catch(()=>{});
    // #endregion
    console.error('Failed to parse AppleScript output:', error);
  }
  
  return notes;
}

/**
 * Parse AppleScript date string to JavaScript Date
 * AppleScript dates can be in multiple formats:
 * - "Thursday, 29 January 2026 at 10:13:02" (day before month, 24-hour)
 * - "Monday, January 1, 2024 at 12:00:00 PM" (month before day, 12-hour)
 */
function parseAppleScriptDate(dateStr: string): Date {
  // Try standard Date parsing first
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  // Format 1: "Thursday, 29 January 2026 at 10:13:02" (day before month, 24-hour)
  const dateMatch1 = dateStr.match(/(\w+), (\d+) (\w+) (\d+) at (\d+):(\d+):(\d+)/);
  if (dateMatch1) {
    const [, , day, monthName, year, hour, minute, second] = dateMatch1;
    const monthMap: { [key: string]: number } = {
      'January': 0, 'February': 1, 'March': 2, 'April': 3,
      'May': 4, 'June': 5, 'July': 6, 'August': 7,
      'September': 8, 'October': 9, 'November': 10, 'December': 11,
    };
    
    if (monthMap[monthName] !== undefined) {
      return new Date(
        parseInt(year, 10),
        monthMap[monthName],
        parseInt(day, 10),
        parseInt(hour, 10),
        parseInt(minute, 10),
        parseInt(second, 10)
      );
    }
  }
  
  // Format 2: "Monday, January 1, 2024 at 12:00:00 PM" (month before day, 12-hour)
  const dateMatch2 = dateStr.match(/(\w+), (\w+) (\d+), (\d+) at (\d+):(\d+):(\d+) (AM|PM)/);
  if (dateMatch2) {
    const [, , monthName, day, year, hour, minute, second, ampm] = dateMatch2;
    const monthMap: { [key: string]: number } = {
      'January': 0, 'February': 1, 'March': 2, 'April': 3,
      'May': 4, 'June': 5, 'July': 6, 'August': 7,
      'September': 8, 'October': 9, 'November': 10, 'December': 11,
    };
    
    if (monthMap[monthName] !== undefined) {
      let hour24 = parseInt(hour, 10);
      if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
      if (ampm === 'AM' && hour24 === 12) hour24 = 0;
      
      return new Date(
        parseInt(year, 10),
        monthMap[monthName],
        parseInt(day, 10),
        hour24,
        parseInt(minute, 10),
        parseInt(second, 10)
      );
    }
  }
  
  throw new Error(`Unable to parse date: ${dateStr}`);
}

/**
 * Strip HTML tags from note body and convert to plain text
 */
function stripHtmlTags(html: string): string {
  if (!html) return '';
  
  try {
    // Use html-to-text library for robust HTML stripping
    return convert(html, {
      wordwrap: false,
      preserveNewlines: true,
    });
  } catch (error) {
    // Fallback: simple regex-based stripping
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}
