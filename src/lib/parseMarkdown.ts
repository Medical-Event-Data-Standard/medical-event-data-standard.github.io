import { Buffer } from 'buffer';

if (typeof window !== 'undefined' && !window.Buffer) {
  (window as any).Buffer = Buffer;
}

// Now use gray-matter safely
import matter from 'gray-matter';

export interface ParsedReadme {
  title: string;
  content: string;
}

/**
 * Parse markdown, extract the first top-level title (#), and return normalized content.
 */
export function parseReadme(readme: string, fallbackTitle: string): ParsedReadme {
  if (!readme) return { title: fallbackTitle, content: '' };

  // Use gray-matter to handle markdown front matter (if present)
  const { content } = matter(readme);

  const lines = content.split('\n');
  let title = fallbackTitle;
  const contentLines: string[] = [];
  let titleFound = false;

  for (const line of lines) {
    const match = line.match(/^#\s+(.*)/);
    if (match && !titleFound) {
      title = match[1].trim();
      titleFound = true;
      continue; // Skip adding this line to content
    }
    contentLines.push(line);
  }

  // Normalize heading levels (decrement all headings by one level)
  const normalizedContent = contentLines
    .map(line => line.replace(/^(#{1,5})\s/g, (_, hashes) => `${hashes}# `))
    .join('\n')
    .trim();

  return { title, content: normalizedContent };
}
