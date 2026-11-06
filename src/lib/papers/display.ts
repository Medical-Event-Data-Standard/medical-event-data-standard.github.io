import type { Paper } from './types';

export type SortOrder = 'newest' | 'most-cited';

/** Sort key for "newest": the publication date if known, else the year (sorting before dated papers that year). */
function dateKey(paper: Paper): string {
  return paper.publicationDate ?? (paper.year === null ? '' : String(paper.year));
}

const byNewest = (a: Paper, b: Paper): number => dateKey(b).localeCompare(dateKey(a));
const byMostCited = (a: Paper, b: Paper): number => (b.citationCount ?? -1) - (a.citationCount ?? -1);
const byTitle = (a: Paper, b: Paper): number => a.title.localeCompare(b.title);

/** Returns a sorted copy: newest first, or most cited first. Papers without a date or count sort last. */
export function sortPapers<T extends Paper>(papers: readonly T[], order: SortOrder): T[] {
  const comparators =
    order === 'most-cited' ? [byMostCited, byNewest, byTitle] : [byNewest, byMostCited, byTitle];
  return [...papers].sort((a, b) => {
    for (const compare of comparators) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return 0;
  });
}

/** True if every whitespace-separated term of `query` occurs (case-insensitively) in the title, authors or venue. */
export function matchesQuery(paper: Paper, query: string): boolean {
  const haystack = [paper.title, ...paper.authors, paper.venue ?? ''].join('\n').toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every(term => haystack.includes(term));
}

/** Formats an author list, truncating long ones to the first `max` authors and "et al.". */
export function formatAuthors(authors: readonly string[], max = 3): string {
  if (authors.length <= max) return authors.join(', ');
  return `${authors.slice(0, max).join(', ')} et al.`;
}

/** Formats an ISO timestamp as e.g. "6 November 2026" (in UTC, so the server and browser render the same). */
export function formatDate(iso: string | null): string | null {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
