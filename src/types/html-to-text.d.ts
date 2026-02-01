declare module 'html-to-text' {
  export interface ConvertOptions {
    wordwrap?: number | false;
    preserveNewlines?: boolean;
    [key: string]: any;
  }

  export function convert(html: string, options?: ConvertOptions): string;
}
